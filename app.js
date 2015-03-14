(function(){
    'use strict';
    var app = angular.module('SkySnippetStoreApp', ['ui.router', 'LocalStorageModule', 'ui.ace', 'gapi']);

    app.config(['$urlRouterProvider', '$stateProvider','localStorageServiceProvider', 'gapiProvider', function($urlRouterProvider, $stateProvider, localStorageServiceProvider, gapiProvider) {
        localStorageServiceProvider.setPrefix('SkySnippetStoreApp');
        $urlRouterProvider.otherwise('/');

        $stateProvider.state('allSnippets', {
          url: '/',
          templateUrl: 'templates/snippets.html',
          controller: 'SnippetsController'
        }).state('addNew', {
            url: '/addNew/:name',
            templateUrl: 'templates/addnew.html',
            controller: 'AddNewController'
        }).state('about', {
            url: '/about',
            templateUrl: 'templates/about.html',
            controller: 'AboutController'
        });
        gapiProvider.apiKey('AIzaSyAhkKUjOu8FQC_hWLBO7j9KMe7477zsYvM');
        gapiProvider.clientId('107996144740-gk5ip9tcm0qvm7mr4bse9jjg5tp0dc9m.apps.googleusercontent.com');
        gapiProvider.apiScope('https://www.googleapis.com/auth/drive');
    }]);

    app.controller('SnippetsController', function($scope, $state, $http, $q, localStorageService, gapi) {
        $scope.loadLocalSnippets = function() {
            $scope.snippets = [];
            localStorageService.keys().forEach(function (item) {
                $scope.snippets.push(localStorageService.get(item));
            });
        };

        $scope.loadLocalSnippets();
        $scope.isLoggedIn = false;

        $scope.openSnippet = function (snippetName) {
            $state.go('addNew', {name: snippetName});
        };

        $scope.removeItem = function (index) {
            var item = $scope.snippets[index]
            $scope.snippets.splice(index, 1);

            localStorageService.remove(item.name);
            if (gapi.isAuth() && (item.fileId != null || item.id != null)) {
                $scope.removeFromDrive(item);
            }
        };

        $scope.driveLogin = function () {
            if (!gapi.isAuth()) {
                gapi.login().then(function() {
                    $scope.isLoggedIn = true;
                    $scope.extractFilesFromDriveExtracted();
                });
            }
            else {
                $scope.isLoggedIn = true;
                $scope.extractFilesFromDriveExtracted();
            }
        };

        $scope.extractFilesFromDriveExtracted = function() {
            gapi.call("drive", "v2", "files", "list").then(function (response) {
                $scope.allFilesOnDrive = response.items;
                $scope.snippetStoreFolder = Enumerable.from(response.items)
                    .firstOrDefault("$.title === 'SnippetStoreFolder'");

                if ($scope.snippetStoreFolder == null) {
                    $scope.createSnippetsFolder();
                    return;
                };

                // get all files in SnippetStore folder
                gapi.call("drive", "v2", "children", "list", {'folderId': $scope.snippetStoreFolder.id}).then(function (resp) {
                    $scope.onlineSnippets = [];
                    $scope.onlineSnippets = Enumerable.from($scope.allFilesOnDrive)
                        .join(Enumerable.from(resp.items), '$.id', '$.id', '$')
                        .toArray();

                    // check files that presents both, local and gDrive
                    $scope.loadLocalSnippets();
                    Enumerable.from($scope.snippets)
                        .join(Enumerable.from($scope.onlineSnippets), '$.name', '$.title', function (a, b) {
                            a.avaliableOnDrive = true;
                            a.fileId = b.id;
                            a.url = b.downloadUrl;
                            $scope.onlineSnippets.splice($scope.onlineSnippets.indexOf(b), 1);
                        }).toArray();

                    $scope.showFilesFromDrive();
                });
            });
        };

        $scope.getFilesFromDrive = function () {
            if (gapi.isAuth()) {
                $scope.showFilesFromDrive();
            }
            else {
                $scope.driveLogin();
            }
        };

        $scope.showFilesFromDrive = function() {
            $scope.onlineSnippets.forEach(function (item) {
                var snippet = new SnippetDTO();
                snippet.id = item.id;
                snippet.name = item.title;
                snippet.createdDate = item.createdDate;
                snippet.modifiedDate = item.modifiedDate;
                snippet.avaliableLocal = false;
                snippet.avaliableOnDrive = true;
                snippet.url = item.downloadUrl;

                $scope.snippets.push(snippet);
                $scope.onlineSnippets.splice($scope.onlineSnippets.indexOf(item), 1);
            });
        };

        $scope.createSnippetsFolder = function() {
            var body = {
                'title': 'SnippetStoreFolder',
                'mimeType': 'application/vnd.google-apps.folder'
            };

            // always create new folder
            var request = window.gapi.client.drive.files.insert({'resource': body});
            request.execute(function(resp) {
                $scope.extractFilesFromDriveExtracted();
            });
        };

        $scope.removeFromDrive = function(snippet){
            var request = window.gapi.client.drive.files.delete({'fileId': snippet.id});
            request.execute(function(resp) {
                snippet.avaliableOnDrive = false;
            });
        };

        $scope.downloadFile = function(snippet) {
            $scope.downloadFileAsync(snippet)
                .success(function(data) {
                    snippet.source = data;
                    snippet.avaliableLocal = true;
                    localStorageService.set(snippet.name, snippet);
                }).error(function(error) {
                    var i = 5;
                    // error handling
                });
        };

        $scope.uploadFile = function(snippet) {
            if (gapi.isAuth()) {
                if (!snippet.avaliableOnDrive) {
                    // first upload to drive
                    $scope.insertFile(snippet, function (ok) {
                        snippet.avaliableOnDrive = true;
                        $scope.extractFilesFromDriveExtracted();
                    });
                }
                else {
                    // update file that exist on drive
                    $scope.updateFile(snippet, function (ok) {
                        $scope.extractFilesFromDriveExtracted();
                    });
                }
            }
        };

        $scope.updateFile = function(snippet, callback) {
            var boundary = '-------314159265358979323846';
            var delimiter = "\r\n--" + boundary + "\r\n";
            var close_delim = "\r\n--" + boundary + "--";
            var contentType = 'text/plain';
            var base64Data = btoa(snippet.source);

            gapi.call("drive", "v2", "files", "get", {'fileId': snippet.fileId}).then(function (resp) {
                var multipartRequestBody =
                    delimiter +
                    'Content-Type: application/json\r\n\r\n' +
                    JSON.stringify(resp) +
                    delimiter +
                    'Content-Type: ' + contentType + '\r\n' +
                    'Content-Transfer-Encoding: base64\r\n' +
                    '\r\n' +
                    base64Data +
                    close_delim;

                var token = window.gapi.auth.getToken().access_token;
                var request = window.gapi.client.request({
                    'path': '/upload/drive/v2/files/' + resp.id,
                    'method': 'PUT',
                    'params': {'uploadType': 'multipart', 'alt': 'json'},
                    'headers': {
                        'Authorization': 'Bearer ' + token,
                        'Content-Type': 'multipart/mixed; boundary="' + boundary + '"'
                    },
                    'body': multipartRequestBody});
                request.execute(callback);
            });
        };

        $scope.insertFile = function (snippet, callback) {
            var boundary = '-------314159265358979323846';
            var delimiter = "\r\n--" + boundary + "\r\n";
            var close_delim = "\r\n--" + boundary + "--";
            var contentType = 'text/plain';

            var metadata = {
                'title': snippet.name,
                'mimeType': contentType,
                'parents': [{'id':$scope.snippetStoreFolder.id}]
            };

            var base64Data = btoa(snippet.source);
            var multipartRequestBody =
                delimiter +
                'Content-Type: application/json\r\n\r\n' +
                JSON.stringify(metadata) +
                delimiter +
                'Content-Type: ' + contentType + '\r\n' +
                'Content-Transfer-Encoding: base64\r\n' +
                '\r\n' +
                base64Data +
                close_delim;

            var token = window.gapi.auth.getToken().access_token;
            var request = window.gapi.client.request({
                'path': '/upload/drive/v2/files',
                'method': 'POST',
                'params': {'uploadType': 'multipart'},
                'headers': {
                    'Authorization': 'Bearer ' + token,
                    'Content-Type': 'multipart/mixed; boundary="' + boundary + '"'
                },
                'body': multipartRequestBody
            });

            request.execute(callback);
        };

        $scope.downloadFileAsync = function(snippet) {
            var deffer = $q.defer();
            var promise = deffer.promise;

            promise.success = function(fn) {
                promise.then(fn);
                return promise;
            };

            promise.error = function(fn) {
                promise.then(null, fn);
                return promise;
            };

            var token = window.gapi.auth.getToken().access_token;
            $http.get(snippet.url, {headers: { Authorization: 'Bearer ' + token }})
                .success(function(data, status, headers, config) {
                    deffer.resolve(data);
                }).error(function(data, status, headers, config) {
                    deffer.reject(status);
                });

            return promise;
        };
    });

    app.controller('AddNewController', function($scope, $state, $stateParams, localStorageService) {
        $scope.currentSnippet = new SnippetDTO();
        if ($stateParams.name != null && $stateParams.name.length > 0) {
            $scope.currentSnippet = localStorageService.get($stateParams.name);
        }

        $scope.submit = function(){
            localStorageService.set($scope.currentSnippet.name, $scope.currentSnippet);
            $state.go('allSnippets');
        };
        $scope.remove = function() {
            if ($scope.currentSnippet.name != '') {
                localStorageService.remove($scope.currentSnippet.name);
                $state.go('allSnippets');
            }
        };
        $scope.aceLoaded = function(_editor) {
            ace.require("ace/ext/language_tools");
            _editor.setTheme("ace/theme/twilight");
            _editor.getSession().setMode("ace/mode/javascript");
            _editor.setOptions({
                useWrapMode: true,
                showGutter: true,
                enableBasicAutocompletion: true,
                enableSnippets: true,
                enableLiveAutocompletion: true
            });
        };
        //$scope.aceChanged = function(e) {
        //    var i = 5;
        //};
    });

    app.controller('AboutController', function($scope) {
        $scope.authorName = 'Maksym Chernenko';
        $scope.location = 'Kiev, Ukraine';
    });

    var SnippetDTO = function(name, source) {
        this.name = name;
        this.source = source;
        this.createdDate = new Date();
        this.modifiedDate = null;
        this.avaliableLocal = true;
        this.avaliableOnDrive = false;
        this.fileId = null;
        this.url = null;
    }
})();

