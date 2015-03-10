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
        $scope.snippets = [];


        localStorageService.keys().forEach(function (item) {
            $scope.snippets.push(localStorageService.get(item));
        });

        $scope.openSnippet = function (snippetName) {
            $state.go('addNew', {name: snippetName});
        };
        $scope.removeItem = function (index) {
            $scope.snippets.splice(index, 1);
        };
        $scope.driveLogin = function () {
            var deffered = $q.defer();
            gapi.login().then(function () {
                gapi.call("drive", "v2", "files", "list").then(function (response) {
                    $scope.allFiles = response.items;
                    $scope.snippetStoreFolder = Enumerable.from(response.items)
                        .firstOrDefault("$.title === 'SnippetStoreFolder'");

                    // get all files in SnippetStore folder
                    gapi.call("drive", "v2", "children", "list", {'folderId': $scope.snippetStoreFolder.id}).then(function (resp) {
                        $scope.onlineSnippets = Enumerable.from($scope.allFiles)
                            .join(Enumerable.from(resp.items), '$.id', '$.id', '$')
                            .toArray();

                        // check files that presents both, local and gDrive
                        Enumerable.from($scope.snippets)
                            .join(Enumerable.from($scope.onlineSnippets), '$.name', '$.title', function (a, b) {
                                a.avaliableOnDrive = true;
                                a.fileId = b.id;
                                a.url = b.downloadUrl;
                                $scope.onlineSnippets.splice($scope.onlineSnippets.indexOf(b), 1);
                            }).toArray();

                        deffered.resolve();
                    });
                })
            });

            return deffered.promise;
        };

        $scope.getFilesFromDrive = function () {
            $scope.driveLogin().then(function () {
                $scope.showFilesFromDrive();
            });
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

                $scope.downloadFileAsync(snippet).success(function(ok) {
                    var i = 5;
                }).error(function(notOk) {
                    var i =5;
                });

                $scope.snippets.push(snippet);
            });
        };

        $scope.removeFromDrive = function(snippet){
            var request = window.gapi.client.drive.files.delete({'fileId': snippet.fileId});

            request.execute(function(resp) {
                snippet.avaliableOnDrive = false;
            });
        };

        $scope.downloadFile = function(snippet) {
            $scope.downloadFileAsync(snippet)
                .success(function(data) {
                    var o = localStorageService.get(snippet.name);
                }).error(function(error) {
                    var i = 5;
                    // error handling
                });
        };

        $scope.uploadFile = function(snippet) {
            //$scope.uploadFileAsync(snippet);
            //$scope.insertFile(snippet, function(ok) {
            //    var i = 5;
            //});

            //$scope.updateFile(snippet, function(ok) {
            //    var i =5;
            //});

            $scope.removeFromDrive(snippet);
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

            // add files that just on gDrive
            //$scope.onlineSnippets.forEach(function(item) {
            //    var snippet = new SnippetDTO();
            //    snippet.id = item.id;
            //    snippet.name = item.title;
            //    snippet.createdDate = item.createdDate;
            //    snippet.modifiedDate = item.modifiedDate;
            //    snippet.avaliableLocal = false;
            //    snippet.avaliableOnDrive = true;
            //
            //    $scope.snippets.push(snippet);
            //
            //    //var token = window.gapi.auth.getToken().access_token;
            //    //$http.get(item.downloadUrl, {headers: { Authorization: 'Bearer ' + token }})
            //    //    .success(function(data, status, headers, config) {
            //    //        var i = 5;
            //    //    }).error(function(data, status, headers, config) { });
            //});


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
        $scope.aceChanged = function(e) {
            var i = 5;
        };
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

