

var CHANNEL = require("./channel");

const HEADER_PREFIX = 'x-wf-';

var requestIndex = 0;


var HttpHeaderChannel = exports.HttpHeaderChannel = function(options) {
    if (!(this instanceof exports.HttpHeaderChannel))
        return new exports.HttpHeaderChannel(options);

    this.__construct(options);

    this.HEADER_PREFIX = HEADER_PREFIX;
}

HttpHeaderChannel.prototype = CHANNEL.Channel();

HttpHeaderChannel.prototype.getFirebugNetMonitorListener = function() {
    if(!this.firebugNetMonitorListener) {
        var self = this;
        this.firebugNetMonitorListener = {
            onResponseBody: function(context, file)
            {
                if(file) {
                    try {
                        
                        var requestId = false;
                        for( var i=file.requestHeaders.length-1 ; i>=0 ; i-- ) {
                            if(file.requestHeaders[i].name=="x-request-id") {
                                requestId = file.requestHeaders[i].value;
                                break;
                            }
                        }

                        self.parseReceived(file.responseHeaders, {
                            "FirebugNetMonitorListener": {
                                "context": context,
                                "file": file
                            },
                            "id": requestId || "id:" + file.href + ":" + requestIndex++,
                            "url": file.href,
                            // TODO: add "hostname" (file.request.URI.host?)
                            // TODO: add "port" (file.request.URI.port?)
                            "method": file.method,
                            "requestHeaders": file.requestHeaders
                        });
                    } catch(e) {
                        console.error(e);
                    }
                }
            }
        }
    }
    return this.firebugNetMonitorListener;
}

HttpHeaderChannel.prototype.getMozillaRequestObserverListener = function(globals) {
    if(!this.mozillaRequestObserverListener) {
        var self = this;
        this.mozillaRequestObserverListener = {
            observe: function(subject, topic, data)
            {
                if (topic == "http-on-examine-response") {

                    var httpChannel = subject.QueryInterface(globals.Ci.nsIHttpChannel);

                    try {
                        var requestHeaders = [];
                        var requestId;
                        httpChannel.visitRequestHeaders({
                            visitHeader: function(name, value)
                            {
                                requestHeaders.push({name: name, value: value});
                                if(name.toLowerCase()=="x-request-id") {
                                    requestId = value;
                                }
                            }
                        });
                        var responseHeaders = [],
                            contentType = false;
                        httpChannel.visitResponseHeaders({
                            visitHeader: function(name, value)
                            {
                                responseHeaders.push({name: name, value: value});
                                if (name.toLowerCase() == "content-type")
                                    contentType = value;
                            }
                        });
                        self.parseReceived(responseHeaders, {
                            "MozillaRequestObserverListener": {
                                "httpChannel": httpChannel
                            },
                            "id": requestId || "id:" + httpChannel.URI.spec + ":" + requestIndex++,
                            "url": httpChannel.URI.spec,
                            "hostname": httpChannel.URI.host,
                            "port": httpChannel.URI.port,
                            "method": httpChannel.requestMethod,
                            "status": httpChannel.responseStatus,
                            "contentType": contentType,
                            "requestHeaders": requestHeaders
                        });
                    } catch(e) {
                        console.error(e);
                    }
                }
            }                
        }
    }
    return this.mozillaRequestObserverListener;
}
