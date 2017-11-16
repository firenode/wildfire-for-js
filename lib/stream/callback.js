
var WILDFIRE = require("../wildfire"),
    JSON = require("fp-modules-for-nodejs/lib/json");

var CallbackStream = exports.CallbackStream = function CallbackStream()
{
    if (!(this instanceof exports.CallbackStream))
        return new exports.CallbackStream();
    this.messagesIndex = 1;
    this.messages = {};

    var self = this;

    this.dispatcher = WILDFIRE.Dispatcher();
    // TODO: Use own protocol here
    this.dispatcher.setProtocol('http://registry.pinf.org/cadorn.org/wildfire/@meta/protocol/component/0.1.0');


    this.receiver = WILDFIRE.Receiver();
    this.receiveHandler = null;

    this.receiver.addListener({
        onMessageReceived: function(context, message)
        {
            var meta = JSON.decode(message.getMeta());

            if(meta[".action"] == "request")
            {
                self.receiveHandler({
                    meta: meta,
                    data: JSON.decode(message.getData())
                }, function(message)
                {
                    if (!message || typeof message !== "object")
                        throw new Error("Did not get message object for receiveHandler response");
                    if (typeof message.data === "undefined")
                        throw new Error("Message object from receiveHandler response does not include 'data' property.");
                    
                    var msg = WILDFIRE.Message();
                    if (typeof message.meta == "undefined")
                        message.meta = {};

                    message.meta[".callbackid"] = meta[".callbackid"];
                    message.meta[".action"] = "respond";

                    try {
                        msg.setMeta(JSON.encode(message.meta));
                    } catch(e) {
                        console.warn("Error JSON encoding meta", e);
                        throw new Error("Error JSON encoding meta: " + e);
                    }
                    try {
                        msg.setData(JSON.encode(message.data));
                    } catch(e) {
                        console.warn("Error JSON encoding data", e);
                        throw new Error("Error JSON encoding data: " + e);
                    }

                    try {
                        self.dispatcher.dispatch(msg, true);
                    } catch(e) {
                        console.warn("Error dispatching message in " + module.id, e);
                        throw new Error("Error '"+e+"' dispatching message in " + module.id);
                    }
                });
            }
            else
            if(meta[".action"] == "respond")
            {
                if(self.messages["i:" + meta[".callbackid"]])
                {
                    self.messages["i:" + meta[".callbackid"]][1](
                        {
                            meta: meta,
                            data: JSON.decode(message.getData())
                        }
                    );
                    delete self.messages["i:" + meta[".callbackid"]];
                }
            }
            else
                throw new Error("NYI");
        }
    });
}

CallbackStream.prototype.setChannel = function(channel)
{
    this.dispatcher.setChannel(channel);
    channel.addReceiver(this.receiver);
}

CallbackStream.prototype.setHere = function(id)
{
    // TODO: Remove suffix once we use our own protocol for callbacks
    this.receiver.setId(id + "-callback");
    // TODO: Remove suffix once we use our own protocol for callbacks
    this.dispatcher.setSender(id + "-callback");
}

CallbackStream.prototype.setThere = function(id)
{
    // TODO: Remove suffix once we use our own protocol for callbacks
    this.dispatcher.setReceiver(id + "-callback");
}

CallbackStream.prototype.send = function(message, callback)
{
    var msg = WILDFIRE.Message();
    if (typeof message.meta == "undefined")
        message.meta = {};

    message.meta[".callbackid"] = this.messagesIndex;
    message.meta[".action"] = "request";

    msg.setMeta(JSON.encode(message.meta));
    msg.setData(JSON.encode(message.data));

    this.messages["i:" + this.messagesIndex] = [msg, callback];
    this.messagesIndex++;

    this.dispatcher.dispatch(msg, true);
}

CallbackStream.prototype.receive = function(handler)
{
    this.receiveHandler = handler;
}
