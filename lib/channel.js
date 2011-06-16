
var UTIL = require("modules/util");
var PROTOCOL = require("./protocol");
var TRANSPORT = require("./transport");

var Channel = exports.Channel = function () {
    if (!(this instanceof exports.Channel))
        return new exports.Channel();
}

Channel.prototype.__construct = function(options) {
    options = options || {};
    this.status = "closed";
    this.receivers = [];
    this.listeners = [];
    this.options = {
        "messagePartMaxLength": 5000
    }
    this.outgoingQueue = [];
    
    if(typeof options.enableTransport != "undefined" && options.enableTransport===false) {
        // do not add transport
    } else {
        this.addReceiver(TRANSPORT.newReceiver(this));
    }
}

Channel.prototype.enqueueOutgoing = function(message, bypassReceivers) {
    return this._enqueueOutgoing(message, bypassReceivers);
}

Channel.prototype._enqueueOutgoing = function(message, bypassReceivers) {
    if(!bypassReceivers) {
        // If a receiver with a matching ID is present on the channel we don't
        // enqueue the message if receiver.onMessageReceived returns FALSE.
        var enqueue = true;
        for( var i=0 ; i<this.receivers.length ; i++ ) {
            if(this.receivers[i].hasId(message.getReceiver())) {
                if(!this.receivers[i].onMessageReceived(null, message)) enqueue = false;
            }
        }
        if(!enqueue) return true;
    }
    this.outgoingQueue.push(this.encode(message));
    return true;
}

Channel.prototype.getOutgoing = function() {
    return this.outgoingQueue;
}

Channel.prototype.clearOutgoing = function() {
    this.outgoingQueue = [];
}

Channel.prototype.setMessagePartMaxLength = function(length) {
    this.options.messagePartMaxLength = length;
}

Channel.prototype.flush = function(applicator, bypassTransport) {
    return this._flush(applicator, bypassTransport);
}

Channel.prototype._flush = function(applicator, bypassTransport) {
    // set request ID if not set
    if(!applicator.getMessagePart("x-request-id")) {
        applicator.setMessagePart("x-request-id", ""+(new Date().getTime()) + "" + Math.floor(Math.random()*1000+1) );
    }

    var messages = this.getOutgoing();
    if(messages.length==0) {
        return 0;
    }

    var util = {
        "applicator": applicator,
        "HEADER_PREFIX": this.HEADER_PREFIX
    };

    if(this.transport && !bypassTransport) {
        util.applicator = this.transport.newApplicator(applicator);
    }

    for( var i=0 ; i<messages.length ; i++ ) {
        var headers = messages[i];
        for( var j=0 ; j<headers.length ; j++ ) {
            util.applicator.setMessagePart(
                PROTOCOL.factory(headers[j][0]).encodeKey(util, headers[j][1], headers[j][2]),
                headers[j][3]
            );
        }
    }
    
    var count = messages.length;

    this.clearOutgoing();

    if(util.applicator.flush) {
        util.applicator.flush(this);
    }

    return count;
}


Channel.prototype.setMessagePart = function(key, value) {
    // overwrite in subclass
}

Channel.prototype.getMessagePart = function(key) {
    // overwrite in subclass
    return null;
}

Channel.prototype.encode = function(message) {
    var protocol_id = message.getProtocol();
    if(!protocol_id) {
        throw new Error("Protocol not set for message");
    }
    return PROTOCOL.factory(protocol_id).encodeMessage(this.options, message);
}

Channel.prototype.setNoReceiverCallback = function(callback) {
    this.noReceiverCallback = callback;
}

Channel.prototype.addReceiver = function(receiver) {
    // avoid duplicates
    for( var i=0 ; i<this.receivers.length ; i++ ) {
        if(this.receivers[i]==receiver) {
            return;
        }
    }
    this.receivers.push(receiver);
}

Channel.prototype.addListener = function(listener) {
    // avoid duplicates
    for( var i=0 ; i<this.listeners.length ; i++ ) {
        if(this.listeners[i]==listener) {
            return;
        }
    }
    this.listeners.push(listener);
}

function dispatch(channel, method, args)
{
    args = args || [];
    for( var i=0 ; i<channel.listeners.length ; i++ ) {
        if(typeof channel.listeners[i][method] === "function") {
            channel.listeners[i][method].apply(null, args);
        }
    }    
}

Channel.prototype.open = function(context) {
    this.status = "open";
    
    dispatch(this, "beforeChannelOpen", [context]);
    
    for( var i=0 ; i<this.receivers.length ; i++ ) {
        if(this.receivers[i]["onChannelOpen"]) {
            this.receivers[i].onChannelOpen(context);
        }
    }
    this.sinks = {
        protocolBuffers: {},
        buffers: {},
        protocols: {},
        receivers: {},
        senders: {},
        messages: {}
    }
    dispatch(this, "afterChannelOpen", [context]);
}

Channel.prototype.close = function(context) {
    this.status = "close";
    dispatch(this, "beforeChannelClose", [context]);
    for( var i=0 ; i<this.receivers.length ; i++ ) {
        if(this.receivers[i]["onChannelClose"]) {
            this.receivers[i].onChannelClose(context);
        }
    }
    dispatch(this, "afterChannelClose", [context]);
}

var parsing = false;

Channel.prototype.parseReceived = function(rawHeaders, context, options) {
    var self = this;

    if (parsing)
    {
        throw new Error("Already parsing!");
    }
    parsing = true;

    options = options || {};
    options.skipChannelOpen = options.skipChannelOpen || false;
    options.skipChannelClose = options.skipChannelClose || false;
    options.enableContinuousParsing = options.enableContinuousParsing || false;

    if(!options.skipChannelOpen) {
        self.open(context);
    }

    if(typeof rawHeaders != "object") {
        rawHeaders = text_header_to_object(rawHeaders);
    }

    // protocol related
    var protocolBuffers = (options.enableContinuousParsing)?this.sinks.protocolBuffers:{};

    // message related
    var buffers = (options.enableContinuousParsing)?this.sinks.buffers:{};
    var protocols = (options.enableContinuousParsing)?this.sinks.protocols:{};
    var receivers = (options.enableContinuousParsing)?this.sinks.receivers:{};
    var senders = (options.enableContinuousParsing)?this.sinks.senders:{};
    var messages = (options.enableContinuousParsing)?this.sinks.messages:{};

    try {
        // parse the raw headers into messages
        for( var i in rawHeaders ) {
            parseHeader(rawHeaders[i].name.toLowerCase(), rawHeaders[i].value);
        }
    
        // empty any remaining buffers in case protocol header was last
        if(protocolBuffers) {
            UTIL.forEach(protocolBuffers, function(item) {
                if(protocols[item[0]]) {
                    if(typeof buffers[item[0]] == "undefined") {
                        buffers[item[0]] = {};
                    }
                    if(typeof receivers[item[0]] == "undefined") {
                        receivers[item[0]] = {};
                    }
                    if(typeof senders[item[0]] == "undefined") {
                        senders[item[0]] = {};
                    }
                    if(typeof messages[item[0]] == "undefined") {
                        messages[item[0]] = {};
                    }
                    item[1].forEach(function(info) {
                        protocols[item[0]].parse(buffers[item[0]], receivers[item[0]], senders[item[0]], messages[item[0]], info[0], info[1]);
                    });
                    delete protocolBuffers[item[0]];
                }
            });
        }
    } catch(e) {
//        dump("Error parsing raw data: " + e);
        // clean up no matter what - a try/catch wrapper above this needs to recover from this properly
        parsing = false;
        buffers = {};
        protocols = {};
        receivers = {};
        senders = {};
        messages = {};
        console.error("Error parsing raw data", e);
        throw e;
    }

    // deliver the messages to the appropriate receivers
    var deliveries = [];
    var messageCount = 0;
    for( var protocolId in protocols ) {

        for( var receiverKey in messages[protocolId] ) {

            // sort messages by index
            messages[protocolId][receiverKey].sort(function(a, b) {
                if(parseInt(a[0])>parseInt(b[0])) return 1;
                if(parseInt(a[0])<parseInt(b[0])) return -1;
                return 0;
            });

            // determine receiver
            var receiverId = receivers[protocolId][receiverKey];
            // fetch receivers that support ID
            var targetReceivers = [];
            for( var i=0 ; i<this.receivers.length ; i++ ) {
                if(this.receivers[i].hasId(receiverId)) {
                    if(this.receivers[i]["onMessageGroupStart"]) {
                        this.receivers[i].onMessageGroupStart(context);
                    }
                    targetReceivers.push(this.receivers[i]);
                }
            }
            
            messageCount += messages[protocolId][receiverKey].length;
            
            if(targetReceivers.length>0) {
                for( var j=0 ; j<messages[protocolId][receiverKey].length ; j++ ) {
                    // re-write sender and receiver keys to IDs
                    messages[protocolId][receiverKey][j][1].setSender(senders[protocolId][receiverKey+":"+messages[protocolId][receiverKey][j][1].getSender()]);
                    messages[protocolId][receiverKey][j][1].setReceiver(receiverId);
                    for( var k=0 ; k<targetReceivers.length ; k++ ) {
                        deliveries.push([targetReceivers[k], messages[protocolId][receiverKey][j][1]]);
                    }
                }
                for( var k=0 ; k<targetReceivers.length ; k++ ) {
                    if(targetReceivers[k]["onMessageGroupEnd"]) {
                        targetReceivers[k].onMessageGroupEnd(context);
                    }
                }
                if (options.enableContinuousParsing)
                    delete messages[protocolId][receiverKey];
            } else
            if(this.noReceiverCallback) {
                this.noReceiverCallback(receiverId);
            }
        }
    }

    if (options.enableContinuousParsing)
    {
        // TODO: Partial cleanup here or above for things we do not need any more
    }
    else
    {
        // cleanup - does this help with gc?
        buffers = {};
        protocols = {};
        receivers = {};
        senders = {};
        messages = {};
    }

    parsing = false;

    var onMessageReceivedOptions;

    deliveries.forEach(function(delivery)
    {
        try {
            onMessageReceivedOptions = delivery[0].onMessageReceived(context, delivery[1]);
        } catch(e) {
            console.error("Error delivering message: " + e, e.stack);
            throw e;
        }
        if(onMessageReceivedOptions) {
            if(onMessageReceivedOptions.skipChannelClose) {
                options.skipChannelClose = true;
            }
        }
    });

    if(!options.skipChannelClose) {
        this.close(context);
    }

    return messageCount;

 
    function parseHeader(name, value)
    {
        if (name.substr(0, self.HEADER_PREFIX.length) == self.HEADER_PREFIX) {
            if (name.substring(0,self.HEADER_PREFIX.length + 9) == self.HEADER_PREFIX + 'protocol-') {
                var id = parseInt(name.substr(self.HEADER_PREFIX.length + 9));
                protocols[id] = PROTOCOL.factory(value);
            } else {
                var index = name.indexOf('-',self.HEADER_PREFIX.length);
                var id = parseInt(name.substr(self.HEADER_PREFIX.length,index-self.HEADER_PREFIX.length));

                if(protocols[id]) {

                    if(typeof buffers[id] == "undefined") {
                        buffers[id] = {};
                    }
                    if(typeof receivers[id] == "undefined") {
                        receivers[id] = {};
                    }
                    if(typeof senders[id] == "undefined") {
                        senders[id] = {};
                    }
                    if(typeof messages[id] == "undefined") {
                        messages[id] = {};
                    }

                    if(protocolBuffers[id]) {
                        protocolBuffers[id].forEach(function(info) {
                            protocols[id].parse(buffers[id], receivers[id], senders[id], messages[id], info[0], info[1]);
                        });
                        delete protocolBuffers[id];
                    }
                    protocols[id].parse(buffers[id], receivers[id], senders[id], messages[id], name.substr(index+1), value);
                } else {
                    if(!protocolBuffers[id]) {
                        protocolBuffers[id] = [];
                    }
                    protocolBuffers[id].push([name.substr(index+1), value]);
                }
            }
        }
    }
    
    function text_header_to_object(text) {
        // trim escape sequences \[...m
//        text = text.replace(/\x1B\x5B[^\x6D]*\x6D/g, "");
        
        if(text.charCodeAt(0)==27 && text.charCodeAt(3)==109) {
            text = text.substring(4);
        }
        var headers = [];
        var lines = text.replace().split("\n");

        var expression = new RegExp("^.{0,2}("+self.HEADER_PREFIX+"[^:]*): (.*)$", "i");
        var m, offset, len, fuzzy = false;

        for( var i=0 ; i<lines.length ; i++ ) {
            if (lines[i])
            {
                if(m = expression.exec(lines[i])) {
                    if (m[1].toLowerCase() === "x-request-id")
                        context.id = m[2];

                    headers.push({
                        "name": m[1],
                        // prefixing value with '~' indicates approximate message length matching
                        // the message length has changed due to the newlines being replaced with &!10;
                        "value": m[2]
                    });
                }
            }
        }

        // This fudges lines together that should not have been split.
        // This happens if the payload inadvertantly included newline characters that
        // were not encoded with &!10;
/*
        for( var i=0 ; i<lines.length ; i++ ) {
            if (lines[i])
            {
                offset = lines[i].indexOf(self.HEADER_PREFIX);
                if (offset >=0 && offset <=3)
                {
                    len = lines[i].length;
                    if (i+1 == lines.length) offset = 0;
                    else offset = lines[i+1].indexOf(self.HEADER_PREFIX);
                    if (
                        (offset >=0 && offset <=3) ||
                        lines[i].charAt(len-1) === "|" ||
                        (lines[i].charAt(len-2) === "|" && lines[i].charAt(len-1) === "\\")
                    )
                    {
                        if(m = expression.exec(lines[i])) {
                            headers.push({
                                "name": m[1],
                                // prefixing value with '~' indicates approximate message length matching
                                // the message length has changed due to the newlines being replaced with &!10;
                                "value": ((true || fuzzy)?"~":"") + m[2]
                            });
                            fuzzy = false;
                        }
                    }
                    else
                    {
                        lines[i] = lines[i] + "&!10;" + lines[i+1];
                        lines.splice(i+1, 1);
                        i--;
                        fuzzy = true;
                    }
                } else
                if(m = expression.exec(lines[i])) {
                    headers.push({
                        "name": m[1],
                        "value": m[2]
                    });
                    fuzzy = false;
                }
            }
        }
*/
        return headers;
    }
}

Channel.prototype.setTransport = function(transport) {
    this.transport = transport;
}

