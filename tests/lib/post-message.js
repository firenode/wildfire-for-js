
var WILDFIRE = require("wildfire/wildfire");

exports.run = function()
{
    var worker1,
        worker2;

    worker1 = new Worker({
        id: "http://worker1",
        to: "http://worker2",
        onMessagePart: function(part)
        {
            worker2.parseMessagePart(part);
        },
        onMessage: function(msg)
        {
            console.log("Received by Worker 1: " + msg);
        }
    });

    worker2 = new Worker({
        id: "http://worker2",
        to: "http://worker1",
        onMessagePart: function(part)
        {
            worker1.parseMessagePart(part);
        },
        onMessage: function(msg)
        {
            console.log("Received by Worker 2: " + msg);
        }
    });

    worker1.send("Hello World from Worker 1");
    worker2.send("Hello World from Worker 2");
    worker1.send("Hello World again from Worker 1");
    worker2.send("Hello World again from Worker 2");

    worker1.send("This is a line.\nAnd another line.");

    worker1.send("This is a line with a \' (backslash) and a special newline \u000a char.");

    // lots of data
    var payload = [];
    for (var i=1, ic=200; i<=ic ; i++)
    {
        payload.push("This is a line of data at line: " + i);
    }
    worker1.send(payload.join("\n"));
/*
    var payload = [    
        'x-request-id: 1302986389714619',
        'x-wf-protocol-1: http://registry.pinf.org/cadorn.org/wildfire/@meta/protocol/component/0.1.0',
        'x-wf-1-index: 3',
        '#x-wf-1-1-receiver: http://worker1',
        '#x-wf-1-1-1-sender: http://worker2',
    ].join("\n");
    worker1.parseMessagePart(payload);
*/
}

var Worker = function(options)
{
    this.channel = WILDFIRE.PostMessageChannel();
    this.channel.setPostMessageSender(options.onMessagePart);

    this.receiver = WILDFIRE.Receiver();
    this.receiver.setId(options.id);
    this.receiver.addListener({
        onMessageReceived: function(context, message)
        {
            options.onMessage(message.getData());
        }
    });
    this.channel.addReceiver(this.receiver);

    this.dispatcher = WILDFIRE.Dispatcher();
    this.dispatcher.setChannel(this.channel);
    this.dispatcher.setProtocol('http://registry.pinf.org/cadorn.org/wildfire/@meta/protocol/component/0.1.0');
    this.dispatcher.setSender(options.id);
    this.dispatcher.setReceiver(options.to);

    var self = this;

    this._dispatch = function(message)
    {
        self.dispatcher.dispatch(message);
    }
}

Worker.prototype.send = function(msg)
{
    var message = WILDFIRE.Message();
    message.setData(msg);
    this._dispatch(message);
}

Worker.prototype.parseMessagePart = function(part)
{
    this.channel.parseReceivedPostMessage(part);
}
