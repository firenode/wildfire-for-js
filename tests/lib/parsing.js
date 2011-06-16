
exports.run = function()
{
    var part = '4592|{"tor"}|{"oraction\'] = \"oader.js:9052\u000a(null,[object Ob\u000a}}|';

    part = part.replace(/\u000a/g, "&#10;");

    var m = part.match(/^(\d*)?\|(.*)\|(\\)?$/);
    
    if (m[1] != 4592)
        throw new Error("OOPS!");
    if (m[2] != '{"tor"}|{"oraction\'] = "oader.js:9052&#10;(null,[object Ob&#10;}}')
        throw new Error("OOPS!");

console.log(m);

}
