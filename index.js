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

'use strict'

// --- exports

module.exports = SkyGnome;

// --- dependencies

const serial = require ('serialport');

// --- helper functions

function clean (text)
{
    return text.replace (/^[^\w]+/, '' )  // leading non-words
               .replace (/\s\s+/g , ' ')  // normalise whitespace
               .trim ();
}

function remove (text, gunk)
{
    return text = clean (text.replace (gunk, ''));  // degunkification
}

// --- the sky gnome class

function SkyGnome (path)
{
    this._stb = new serial (path,
    {
        autoOpen : false,
        baudRate : 57600,
        dataBits : 8,
        stopBits : 1,
        parity   : 'none'
    });

    // --- listen to the sky serial port - connect the wire before calling this method

    this.listen = function (callback)
    {
        var self = this;

        self._stb.open (function (error)
        {
            const PACKET_START = 10;
            const PACKET_LEN   =  3;

            if (error)
            {
                callback (error, false);  // probably a connection issue
            }

            var packet = '';

            self._stb.on ('readable', function ()
            {
                var data = self._stb.read ();

                // the gnome protocol is a PACKET_START followed by PACKET_LEN
                // bytes which outline the lenght of the remaining packet,
                // including a trailing checksum

                data.forEach (function (datum)
                {
                    if (datum == PACKET_START)
                    {
                        packet = '';  // start of a new packet
                    }
                    else
                    {
                        packet += String.fromCharCode (datum);

                        if (packet.length > PACKET_LEN)  // wait for at least this
                        {
                            if (packet.length == parseInt (packet.substr (0, PACKET_LEN)))  // is it a complete packet
                            {
                                var data = _read (packet);  // read the packet

                                if (callback (false, data))
                                {
                                    self._stb.close ();  // stop listening
                                }
                            }
                        }
                    }
                });
            })
        })
    }

    // --- reads a packet and transforms it into useful data

    var _read = function (packet)
    {
        const SIZE_LEN  = 3;
        const SIZE_ACT  = 4;
        const SIZE_HEAD = SIZE_ACT + SIZE_LEN;

        var pos  = SIZE_LEN;
        var inf  = [];
        var data =  // its better (and easier) for the client for us to make null entries for *all* the properties that may occur
        {
            received: new Date (),
            channel:
            {
                number : null,
                name   : null
            },
            program:
            {
                title    : null,
                synopsis : null,
                season   : null,
                episodes : null,
                episode  : null,
                duration : null,
                year     : null,
                warnings : []
            },
            showing:
            {
                started    : null,
                attributes : [],
            },
            epg:
            {
                channel : null,
                started : null,
                title : null,
                description : null
            },
            system:
            {
                message     : null,
                trickplay   : null,
                pin         : null,
                power       : null,
                interactive : null,
                other       : []
            }
        };

        while (pos < packet.length)  // still more to read
        {
            var act = packet.substr (pos, SIZE_ACT);
            var len = parseInt (packet.substr (pos + SIZE_ACT, SIZE_LEN));
            var txt = packet.substr (pos + SIZE_HEAD, len - SIZE_HEAD);

            _action (act, txt, data);  // interpret the action

            if (data.program.synopsis)  // find useful info in the synopsis
            {
                if (data.program.title)  // normalise long titles
                {
                    _title (data);
                }

                _metadata    (data);
                _attributes  (data);
                _descriptors (data);
            }

            pos += len;
        }

        return data;
    }

    // --- interprets individual actions from within the packet

    var _action = function (action, text, data)
    {
        switch (action)
        {
            case 'SSCN':
            case 'CE00':   // whilst entering channel number . '1__', '10_', etc
            {
                data.channel.number = parseInt (text);
                data.epg.channel = text;
            }
            break;

            case 'SSCA':
            {
                data.channel.name = text;
            }
            break;

            case 'SSDT':
            {
                // just the current time - we ignore this one
            }
            break;

            case 'SST0':
            {
                var parts = /(\d+)\.(\d+)([ap]m)/.exec (text.toLowerCase ());  // programme start like . 9.23pm, 10.02am, etc
                var hour  = parseInt (parts [1]) + (parts [3] == 'pm' ? 12 : 0);
                var min   = parseInt (parts [2]);
                var now   = new Date ();
                var start = new Date (now.getFullYear (), now.getMonth (), now.getDate (), hour, min, 0, 0);

                if (start > now)  // if in future - we must of straddled the midnight boundary
                {
                    start.setDate (start.getDate () - 1);  // it was yesterday
                }

                data.showing.started = start;
                data.epg.started     = text;
            }
            break;

            case 'SSN0':
            {
                data.program.title = text;
                data.epg.title     = text;
            }
            break;

            case 'SSE0':
            {
                data.program.synopsis = text;
                data.epg.description  = text;
            }
            break;

            case 'SSEI':
            {
                data.system.trickplay = text.toLowerCase ();  // . pause, fwd, rewind, etc
            }
            break;

            case 'CEER':  // invalid channel number
            case 'SYFS':  // audio unavailable
            case 'SYD1':  // other system messages
            case 'PUSP':  // signal stuff like: no satellite signal
            case 'PUCP':  // conditional access stuff like: enter pin number, not subscribed, etc
            {
                if (text.length > 1)  // sometimes just a junk char like '0'
                {
                    data.system.message = text;
                }
            }
            break;

            case 'SYIC':
            {
                data.system.pin = (text == '8080');   // T = pin required, F = pin not requiredß
            }
            break;

            case 'SYST':
            {
                data.system.power = (text == '0');  // T = powered on, F = powered off
            }
            break;

            case 'SYIA':
            {
                data.system.interactive = (text == '1');  // T = entered interactive, F = left interactive
            }
            break;

            default:  // an as yet unknown action
            {
                if (text.length)
                {
                    data.system.other.push (action + ':' + text);  // just present as 'other' for now
                }
            }
            break;
        }
    }

    // --- extracts useful metadata from within the prgramme synopsis

    var _metadata = function (data)
    {
        // regular expressions used to extract metadata from within the body of the
        // synopsis - best leave the order of analysis alone

        const METADATA =
        [
            { regex: /\((\d\d\d\d)\)/                           , values: ['year'] },                 // (2003)
            { regex: /\((\d+)\s+mins?\)/                        , values: ['duration'] },             // (122 mins)
            { regex: /\([Ee][Pp]\s?(\d+)\)/                     , values: ['episode'] },              // Ep 12, (Ep4)
            { regex: /\([Ee][Pp]\s?(\d+)\/(\d+)\)/              , values: ['episode', 'episodes'] },  // (Ep 3/4), Ep5/7
            { regex: /\(?(\d+)\/(\d+)\)?[^\w\s]/                , values: ['episode', 'episodes'] },  // 6/8, (8/9)
            { regex: /\(?[Ss]\s*(\d+)[,\s]+[Ee][Pp]\s*(\d+)\)?/ , values: ['season' , 'episode' ] }   // S3, Ep 3, S4,ep5
        ]

        METADATA.forEach (function (meta)
        {
            var match = meta.regex.exec (data.program.synopsis);

            if (match)
            {
                var full = match.shift ();  // first item is the full matching string

                meta.values.forEach (function (value)
                {
                    data.program [value] = parseInt (match.shift ());
                });

                data.program.synopsis = remove (data.program.synopsis, full);
            }
        });
    }

    // --- extracts program attributes held in square brackets within the synopsis

    var _attributes = function (data)
    {
        // attributes are held within [square brackets], broken by commas and
        // generally held at the end of the synopsis

        const ATTRIBUTES =
        {
             AD : 'audio description',
              C : 'copy protected',
             DS : 'dolby stereo',
             HD : 'high definition',
              S : 'subtitles',
             SL : 'sign language',
            UHD : 'ultra high definition',
              W : 'widescreen'
        }

        var squared = /\[([^\]]+)\]/g;
        var matches = [];
        var match;

        while (match = squared.exec (data.program.synopsis))  // often more than one
        {
            matches.push (match);
        }

        matches.forEach (function (match)
        {
            var parts = match [1].split (',');

            parts.forEach (function (part)
            {
                if (part.trim () in ATTRIBUTES)
                {
                    data.showing.attributes.push (ATTRIBUTES [part.trim ()]);
                }
            });

            data.program.synopsis = remove (data.program.synopsis, match [0]);
        });
    }

    // --- remove content descriptors from the last sentence of the synopsis

    var _descriptors = function (data)
    {
        // content descriptors are bundled into the last sentence of the synopsis

        const DESCRIPTORS =
        {
            'strong language' : 'strong language',
            'flashing images' : 'flashing images',
                   'violence' : 'violent scenes',
                        'sex' : 'sex or nudity',
              'mature themes' : 'mature themes',
                 'mono sound' : 'mono sound only',
                 'also in hd' : ''  // not stored - should really be in attributes
        }

        var last = /\.\s([^\.]+)\.$/.exec (data.program.synopsis);  // the last of multiple sentences

        if (last)
        {
            var sentence = last [1].toLowerCase ();
            var matched  = false;

            for (var key in DESCRIPTORS)
            {
                if (sentence.indexOf (key) > -1)
                {
                    matched = true;

                    if (DESCRIPTORS [key])  // do we want to store it
                    {
                        data.program.warnings.push (DESCRIPTORS [key]);
                    }
                }
            }

            if (matched)  // did we find even one
            {
                data.program.synopsis = remove (data.program.synopsis, last [0]) + '.';  // put the trailing fullstop back
            }
        }
    }

    // --- rejoins long titles that have been split up

    function _title (data)
    {
        // sometimes the title is split with ellipes and then continued into the
        // leading edge of the synopsis

        const ELLIPSE = '...';

        if (data.program.title.endsWith (ELLIPSE) && data.program.synopsis.startsWith (ELLIPSE))
        {
            var colon = data.program.synopsis.substr (ELLIPSE.length).indexOf (':');  // first colon
            var fspot = data.program.synopsis.substr (ELLIPSE.length).indexOf ('.');  // first full stop
            var split = -1;

            if (colon == -1 && fspot > -1)
            {
                split = fspot;
            }
            else if (fspot == -1 && colon > -1)
            {
                split = colon;
            }
            else if (fspot > -1 && colon > -1)
            {
                split = Math.min (fspot, colon);  // takes earliest of the two
            }

            if (split > -1)  // is there a split point in the synopsis
            {
                var first  = data.program.title.substr (0, data.program.title.length - ELLIPSE.length);
                var second = data.program.synopsis.substr (ELLIPSE.length, split);
                var rest   = data.program.synopsis.substr (ELLIPSE.length + split + 1);

                data.program.title    = clean (first + ' ' + second);
                data.program.synopsis = clean (rest);
            }
        }
    }
}
