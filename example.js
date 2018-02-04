/*
 * node sky-gnome v1.0.0
 * https://github.com/pete-rai/node-sky-gnome
 *
 * Copyright 2018 Pete Rai
 * Released under the MIT license
 * https://github.com/pete-rai/node-sky-gnome/blob/master/LICENSE
 *
 * Released with the karmaware tag
 * https://pete-rai.github.io/karmaware
 *
 * Website  : http://www.rai.org.uk
 * GitHub   : https://github.com/pete-rai
 * LinkedIn : https://uk.linkedin.com/in/raipete
 * NPM      : https://www.npmjs.com/~peterai
 *
 */

console.log ();
console.log ('-'.repeat (80));
console.log ('node sky-gnome example code - press RETURN to exit')

var stop = false;

process.openStdin ().on ('data', function ()
{
    stop = true;
    this.pause ();
});

const SkyGnome = require ('sky-gnome');

var stb = new SkyGnome ('/dev/cu.usbserial');  // the path to your serail interface

stb.listen (function (error, data)
{
    console.log ('-'.repeat (80));

    if (error)
    {
        console.log (error);
    }
    else
    {
        console.log (data);
    }

    return stop;  // or dont have a return at all to carry on forever
});
