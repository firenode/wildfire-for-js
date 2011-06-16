
var CHANNEL = require("./channel"),
    UTIL = require("modules/util");

const HEADER_PREFIX = 'x-wf-';

var PostMessageChannel = exports.PostMessageChannel = function () {
    if (!(this instanceof exports.PostMessageChannel))
        return new exports.PostMessageChannel();
    
    this.__construct();

    this.HEADER_PREFIX = HEADER_PREFIX;
    
    this.postMessageSender = null;
}

PostMessageChannel.prototype = CHANNEL.Channel();

PostMessageChannel.prototype.enqueueOutgoing = function(message, bypassReceivers)
{
    var ret = this._enqueueOutgoing(message, bypassReceivers);

    var parts = {};
    this.flush({
        setMessagePart: function(key, value) {
            parts[key] = value;
        },
        getMessagePart: function(key) {
            if (typeof parts[key] == "undefined")
                return null;
            return parts[key];
        }
    });

    var self = this;

    var payload = [];
    UTIL.forEach(parts, function(part)
    {
        payload.push(part[0] + ": " + part[1]);
    });
    self.postMessageSender(payload.join("\n"));
    
    return ret;
}

PostMessageChannel.prototype.setPostMessageSender = function(postMessage)
{
    this.postMessageSender = postMessage;
}

PostMessageChannel.prototype.parseReceivedPostMessage = function(msg)
{
    if (this.status != "open")
        this.open();
    this.parseReceived(msg, null, {
        skipChannelOpen: true,
        skipChannelClose: true,
        enableContinuousParsing: true
    });
}
