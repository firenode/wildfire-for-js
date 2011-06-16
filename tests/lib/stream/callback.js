
var WILDFIRE = require("wildfire/wildfire"),
    JSON = require("modules/json");

exports.run = function()
{    
    var channel1 = WILDFIRE.PostMessageChannel(),
        channel2 = WILDFIRE.PostMessageChannel();

    channel1.setPostMessageSender(function(part)
    {
        channel2.parseReceivedPostMessage(part);        
    });

    channel2.setPostMessageSender(function(part)
    {
        channel1.parseReceivedPostMessage(part);        
    });
    
    var callbackStream1 = WILDFIRE.CallbackStream(),
        callbackStream2 = WILDFIRE.CallbackStream();

    callbackStream1.setChannel(channel1);
    callbackStream1.setHere("1");
    callbackStream1.setThere("2");

    callbackStream2.setChannel(channel2);
    callbackStream2.setHere("2");
    callbackStream2.setThere("1");

    callbackStream2.receive(function(message, respond)
    {
        respond(message);
    });

    callbackStream1.send({
        meta: {
            key: "value"
        },
        data: {
            data: "Sample Data"
        }
    }, function(message)
    {
        if (message.meta.key != "value")
            throw new Error("OOPS!");
        if (message.data.data != "Sample Data")
            throw new Error("OOPS!");

        console.log("CALLBACK CALLED!", message);
    });

    var og = '{"origin":{"type":"map","map":[[{"type":"text","text":"name","lang.type":"string"},{"type":"text","text":"value","lang.type":"string"}],[{"type":"text","text":"func","lang.type":"string"},"[function][function testFunction(arg)\n        {\n            return {\n                key: \"value\"\n            };\n        }]"],[{"type":"text","text":"subData","lang.type":"string"},{"type":"text","text":"{\"name\":\"value\"}","lang.type":"string"}]],"lang.type":"array"}}';
    callbackStream1.send({
        data: {
            og: og
        }
    }, function(message)
    {
        if (message.data.og != og)
            throw new Error("OOPS!");

        console.log("CALLBACK CALLED!", message);
    });
}
