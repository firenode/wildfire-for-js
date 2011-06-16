
exports.Receiver = function() {
    return require("./receiver").Receiver();
}

exports.Dispatcher = function() {
    return require("./dispatcher").Dispatcher();
}

exports.Message = function() {
    return require("./message").Message();
}

exports.HttpHeaderChannel = function(options) {
    return require("./channel-httpheader").HttpHeaderChannel(options);
}

exports.HttpClientChannel = function() {
    return require("./channel/http-client").HttpClientChannel();
}

exports.ShellCommandChannel = function() {
    return require("./channel-shellcommand").ShellCommandChannel();
}

exports.PostMessageChannel = function() {
    return require("./channel-postmessage").PostMessageChannel();
}

exports.CallbackStream = function() {
    return require("./stream/callback").CallbackStream();
}
