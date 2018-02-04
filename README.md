# node-sky-gnome

> Visit my [Blog](http://www.rai.org.uk) to get in touch or to
see demos of this and much more.

## Overview

This is a node module which connects, reads and interprets the Sky Gnome protocol.

Every retail Sky set-top-box pumps out a bunch of information about it's current
state over a serial interface. If you pull the box out and look at the back panel,
you will see an [RS-232](https://en.wikipedia.org/wiki/RS-232) interface port.
Now, unless you bought your computer in the last century, you won't have a native
RS-232 port, but luckily you can buy an [RS-232-to-USB cable](https://www.amazon.com/s?field-keywords=rs232+to+usb)
for around the same cost as a cup of coffee.

Plug one end into the set-top-box, the other into your computer (after you install
the drivers that come with the cable), run this code and - hey presto - you will
get lots of dynamic, contextual, JSON about the current channel and programme.

Why does the box make this information available? Well it all stems back to a
connected speaker they used to sell called [Sky Gnome](https://en.wikipedia.org/wiki/Sky_Gnome).
Alas, these speakers are no more, but the Gnome protocol is still there and even the
new boxes are still sending lots of useful data over the serial interface.

_I am unclear if this works only on Sky UK boxes. I suspect it will work across
all the Sky European boxes, but have no evidence either way._ If you know, then
please do get in touch and share this information.

My thanks to Joseph Heenan over at [Dusky Control](https://www.dusky-control.com)
for [documenting the Gnome protocol](https://www.dusky-control.com/gnome-protocol.shtml).

_NOTE: When you buy the cable, make sure you get one without the two nuts either side
of the pins (or at least with removable nuts). There are nuts like these around the
port on the box itself - so, if the cable has them too, it ain't gonna fit._

### License

This plugin is available under [the MIT license](https://github.com/pete-rai/node-sky-gnome/blob/master/LICENSE).
_Please respect the terms of the license._

### Karmaware

This software is released with the [karmaware](https://pete-rai.github.io/karmaware) tag

### Disclaimer

I've done best efforts testing on my own set top box. If you find any problems,
do let me know by raising an issue [here](https://github.com/pete-rai/node-sky-gnome/issues).
Better still, create a fix for the problem too and drop in the changes; that way
everyone can benefit from it.

### Installation

This project assumes you are familiar with the whole [nodejs](https://nodejs.org/en/) thing.

```
npm install sky-gnome
```

### Dependencies

This plug relies on the [serialport node module](https://www.npmjs.com/package/serialport) - but
this is all taken care of by the node package manager. After cloning this repo, you
just need to:

```
npm install serialport
```

## Example Usage

Here is the simplest example of using this node module:

```javascript
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
```

When you try this for yourself, you need to know the path to your serial-to-USB interface.
On my Mac, this is 'dev/cu.usbserial' - but on your computer this may be in a different
place. The documentation that came with your cable should detail the exact location.

### Output Data

Here is a breakdown of all the data that you can expect to receive from the set
top box. _NOTE: You will not get all this data all the time._ It arrived in logical
bunches depending upon the action which just occurred on the box. Play with it for a
while and you will see how it all works.

| Key | Type | Description |
|:---|:---:|:---|
| received | date | When the message was received from the set top box |
| channel.* |   | Information about the current channel |
| channel.number | int | Three digit channel number |
| channel.name | string | Channel name as per the EPG |
| program.* |   | Information about the current programme |
| program.title | string | Name of the current programme |
| program.synopsis | string | Description of the current programme |
| program.season | int | Season number |
| program.episodes | int | Episode number |
| program.episode | int | Total number of episodes |
| program.duration | int | Programme duration in minutes |
| program.year | int | Year of production |
| program.warnings | array of string | Content warnings (see below) |
| showing.* |    | Information about the current programme schedule showing |
| showing.started | date | When the current programme began |
| showing.attributes | array of string | Content attributes (see below) |
| epg.* |   | The raw as received data from the Gnome protocol |
| epg.channel | string | Channel number - the raw as received data |
| epg.started | string | Programme start time - the raw as received data |
| epg.title | string | Programme name - the raw as received data |
| epg.description | string | Programme description - the raw as received data |
| system.* |    | Information about the current state of the set top box |
| system.message | string | A user message from the set top box |
| system.trickplay  | string | Sky+ actions like rewind, pause, playback, et al |
| system.pin | boolean | T = pin required, F = pin not required |
| system.power | boolean | T = powered on, F = powered off |
| system.interactive | boolean | T = entered interactive, F = left interactive |
| system.other | array of string | Content warnings (see below) |

Here is the full list of showing.attributes:

* audio description
* copy protected
* dolby stereo
* high definition
* subtitles
* sign language
* ultra high definition
* widescreen

Here is the full list of program.warnings:

* strong language
* flashing images
* violent scenes
* sex or nudity
* mature themes
* mono sound only

You may notice that the data coming back from the node module, goes beyond that
which the Gnome protocol makes available by itself. That is because this module extracts
additional information from within the body of the synopsis. Sky has a habit of
packing stuff in there. For example:

> A ragtag group of rebels embark on a daring, against-all-odds mission to thwart the planet-destroying plans of the Empire. Thrilling fantasy adventure with Felicity Jones. (2016)(128 mins)

As you can see here we have the year of production and the running time within
the synopsis text. This node module pulls stuff like this out via some regex magic
and makes it available directly. It also, removes them from the synopsis to give
a cleaner content descriptor. It does some other useful stuff too, like rejoining
long titles that have been split into the synopsis with trailing ellipes.

Despite all this goodness, if you just want the data as received via
the Gnome protocol, then that is present too within the 'epg' portion of the JSON
document.

Finally, here is an example of the JSON documents you can expect:

```javascript
{
    received: 2018-02-04T23:14:04.591Z,
    channel:
    {
        number: 311,
        name: 'Sky ScFi/HorHD'
    },
    program:
    {
        title: 'Rogue One: A Star Wars Story',
        synopsis: 'A ragtag group of rebels embark on a daring, against-all-odds mission to thwart the planet-destroying plans of the Empire. Thrilling fantasy adventure with Felicity Jones.',
        season: null,
        episodes: null,
        episode: null,
        duration: 128,
        year: 2016,
        warnings: []
    },
    showing:
    {
        started: 2018-02-04T21:00:00.000Z,
        attributes: []
    },
    epg:
    {
        channel: '311',
        started: '9.00pm',
        title: 'Rogue One: A Star Wars Story',
        description: 'A ragtag group of rebels embark on a daring, against-all-odds mission to thwart the planet-destroying plans of the Empire. Thrilling fantasy adventure with Felicity Jones. (2016)(128 mins)'
    },
    system:
    {
        message: null,
        trickplay: null,
        pin: null,
        power: null,
        interactive: null,
        other: []
    }
}
```

_– [Pete Rai](http://www.rai.org.uk)_
