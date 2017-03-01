var magnetLogoURL = chrome.extension.getURL('magnet16.png');
var videoQualityRegex = /\b(720|1080)p?\b/i;

var extensionOptions = {
    categorizeTvShows: false,
    customItems: {
        tvShow: false,
        quality: false
    },
    initialize: function() {
        var switches = {
            categorizeTvShows: "group"
        },
            params = Utils.URL.params,
            param;

        for (var name in switches) {
            if (!switches.hasOwnProperty(name)) {
                continue;
            }
            param = switches[name];
            if (params.hasOwnProperty(param)) {
                this[name] = params[param] == "1"
            }
        }
    }
};

var Utils = {};
Utils.URL = (function(){
    var cls = {
        getParams: function (url) {
            var sPageURL      = decodeURIComponent(url ? url : window.location.search.substring(1)),
                sURLVariables = sPageURL.split('&'),
                params        = {},
                current,
                sParam,
                sValue,
                i;

            for (i = 0; i < sURLVariables.length; i++) {
                sParam = sURLVariables[i].split('=');
                sValue = sParam.length == 1 ? true : sParam[1];
                sParam = sParam[0];
                if (params.hasOwnProperty(sParam)) {
                    current = params[sParam];
                    if (!Array.isArray(current)) {
                        current = [current];
                    }
                    current.push(sValue);
                    sValue = current;
                }
                params[sParam] = sValue;
            }
            return params;
        },
        getParam:  function (sParam, params) {
            params = params ? params : this.params;
            return params.hasOwnProperty(sParam) ? params[sParam] : null;
        }
    };
    cls.params = cls.getParams();
    return cls;
}());
Utils.Arrays = {
    flatten2: function() {
        var arrays = [].slice.call(arguments);
        var flattened = [].concat.apply([], arrays);
        debugger;
        return flattened;
    },
    // This is done in a linear time O(n) without recursion
    // memory complexity is O(1) or O(n) if mutable param is set to false
    flatten: function(array, mutable) {
        var result = [];
        var nodes  = (mutable && array) || array.slice();
        var node;

        if (!array.length) {
            return result;
        }

        node = nodes.pop();

        do {
            if (Array.isArray(node)) {
                nodes.push.apply(nodes, node);
            } else {
                result.push(node);
            }
        } while (nodes.length && (node = nodes.pop()) !== undefined);

        result.reverse(); // we reverse result to restore the original order
        return result;
    },
    compareTo: function (main, other) {
        var mainFlat = this.flatten(main);
        var otherFlat = this.flatten(other);

        for (var i = 0, j = mainFlat.length; i < j; i++) {
            var diff = mainFlat[i] - otherFlat[i];
            if (diff != 0) {
                return diff;
            }
        }
        return 0;
    }
};
Utils.Strings = {
    parseSize: function (text) {
        var sizes = text.split(' ', 2);
        var size = sizes[0];
        var suffix = sizes[1].toUpperCase();
        var multipliers = ['B', 'KB', 'MB', 'GB', 'TB'];
        var iMultiplier = multipliers.indexOf(suffix);
        var multiplier = 1024 ^ iMultiplier;
        var totalSize = size * multiplier;
        return {
            total: totalSize,
            base: size,
            suffix: suffix,
            summary: size + ' ' + suffix
        };
    }
};
Utils.Classes = {
    compareTo:     function (main, other) {
        var a = main.getSortArray(),
            b = other.getSortArray();
        return Utils.Arrays.compareTo(a, b);
    }
} ;

function TvShow(text) {
    var match  = typeof text === "string"
        ? TvShow.match(text)
        : text;
    this.valid = (match !== null);
    if (!this.valid) {
        return;
    }
    var season    = match[5];
    this.isSeason = (typeof season !== "undefined");
    if (this.isSeason) {
        this.season = Number(season);
        return;
    }
    var group    = match[1] ? 1 : 3;
    this.season  = Number(match[group]);
    this.episode = Number(match[group + 1]);
}

TvShow.regex = /\b(?:S(\d{1,2})E(\d{1,3})|(\d{1,2})x(\d{1,3})|S(?:eason[ \._]?)?(\d{1,2}))\b/i;
TvShow.match = function (text) {
    return TvShow.regex.exec(text);
};
TvShow.parse = function (text) {
    var match = TvShow.match(text);
    return match
        ? new TvShow(match)
        : null;
};

TvShow.prototype = {
    toSeasonString: function () {
        return "S" + (this.season < 10 ? "0" : "") + this.season;
    },
    toString:       function () {
        return this.isSeason
            ? this.toSeasonString()
            : this.season + "x" + (this.episode < 10 ? "0" : "") + this.episode;
    },
    toStringFull:   function () {
        return this.isSeason
            ? "Season " + this.season
            : this.toSeasonString() + "E" + (this.episode < 10 ? "0" : "") + this.episode;
    },
    getSortArray:  function () {
        return [
            this.isSeason ? 0 : 1,
            this.season,
            this.episode
        ]
    },
    /**
     *
     * @param other {TvShow}
     */
    compareTo:     function (other) {
        return Utils.Classes.compareTo(this, other);
    }
};

function Torrent(link, name, single, size, seeds, peers, age) {
    this.link   = link;
    this.name   = name;
    this.size = size;
    this.seeds = seeds;
    this.peers = peers;
    this.tvShow = TvShow.parse(name);
    var quality = videoQualityRegex.exec(name);
    this.quality = quality ? Number(quality) : 0;
    this.age = age;
    if (single) {
        this.parseTrackers();
        this.linkElement           = document.createElement('dl');
        this.linkElement.innerHTML = '<dt><a href="' + this.getMagnetURI() + '"><span class="u magnet" style="background-image:url(' + magnetLogoURL + ');">Magnet</span></a></dt>';
    } else {
        var t            = this;
        this.linkElement = document.createElement('span');
        this.linkElement.setAttribute('class', 'm');

        if (this.quality && extensionOptions.customItems.quality) {
            var videoResolution = document.createElement('div');
            videoResolution.setAttribute('class', 'video-resolution');
            videoResolution.innerHTML = this.quality;
            this.linkElement.appendChild(videoResolution);
        }

        if (this.tvShow && extensionOptions.customItems.tvShow) {
            var tvInfo = document.createElement('div');
            tvInfo.setAttribute('class', 'tv-show');
            tvInfo.innerHTML = this.tvShow.toString();
            this.linkElement.appendChild(tvInfo);
        }

        var a = document.createElement('a');
        a.setAttribute('href', this.getMagnetURI());
        a.setAttribute('title', 'Fetching trackers...');
        a.setAttribute('class', 'magnet');
        a.innerHTML = '<img src="' + magnetLogoURL + '" />';
        a.addEventListener('mouseover', function () {
            if (!t.trackers)
                t.timeout = setTimeout(function () {
                    t.getTrackers()
                }, 100);
        });
        a.addEventListener('mouseout', function () {
            if (t.timeout)
                clearTimeout(t.timeout);
        });

        this.linkElement.appendChild(a);
    }
}
Torrent.patterns = (function() {
    var hash = "\\b([a-z\\d]{40})\\b";
    var hashLink = "\/" + hash + "\/";
    return {
        hash: /\/([a-z\d]{40})\//i,
        hashOld: new RegExp(hash, "gi"),
        hashLink: new RegExp(hashLink, "gi")
    };
})();
Torrent.prototype = {
    getMagnetURI:  function () {
        var trackers = this.trackers ? '&tr=' + this.trackers.join('&tr=') : '';
        return 'magnet:?xt=urn:btih:' + this.getHash() + '&dn=' + encodeURI(this.name) + trackers;
    },
    parseTrackers: function (html) {
        var doc       = html ? (new DOMParser()).parseFromString(html, 'text/html') : document;
        var q         = doc.querySelector('#text_area_mtorrent');
        var trackers  = q ? q.innerText : "";
        this.trackers = trackers.split(/[\r\n]+/);
    },
    getTrackers:   function () {
        var t       = this;
        var request = new XMLHttpRequest();
        request.open('GET', this.link, true);
        request.onload = function () {
            if (request.status >= 200 && request.status < 400) {
                t.parseTrackers(request.responseText);
                var a = t.linkElement.querySelector('a');
                a.setAttribute('href', t.getMagnetURI());
                a.setAttribute('title', 'Trackers added!');
                a.style.opacity = 1;
            }
        };
        request.send();
    },
    getHash:       function () {
        var match = Torrent.patterns.hash.exec(this.link);
        if (!match) {
            debugger;
        }
        return match ? match[1] : "";
    },
    getSortArray:  function () {
        var sortArray = this.tvShow.getSortArray();
        return [
            sortArray,
            [
                this.seeds ? -1 * this.seeds : 0
            ]
        ]
    },
    /**
     *
     * @param other {Torrent}
     */
    compareTo:     function (other) {
        return Utils.Classes.compareTo(this, other);
    }
};

function processResults(results) {
    results.classList.add("results");
    var searchItems = results.querySelectorAll(':scope > div:not([class])');
    var tvShows     = [];
    var i,j;
    for (i = 0, j = searchItems.length; i < j; i++) {
        var element, main;
        var currentItem = searchItems[i];
        var items       = currentItem.querySelectorAll(':scope > span');
        var itemNum     = 0;
        element         = main = items[itemNum++];
        var link        = element && element.querySelector(':scope > a');
        if (!link) {
            continue;
        }
        element         = element.querySelector(':scope > span');
        var category    = element && element.innerText || "Unknown";
        element         = items[itemNum++];
        var seeds       = element && Number(element.innerText) || -1;
        element         = items[itemNum++];
        var peers = element && Number(element.innerText) || -1;
        element         = items[itemNum++];
        var age = element && Utils.Strings.parseSize(element.innerText) || 0;
        element         = items[itemNum++];
        var size = element && Utils.Strings.parseSize(element.innerText) || 0;
        currentItem.classList.add("torrent");
        var torrent = new Torrent(
            link.getAttribute('href'),
            link.innerText,
            false,
            size,
            seeds,
            peers,
            age
        );
        if (torrent.tvShow) {
            tvShows.push({
                torrent: torrent,
                row:     currentItem
            })
        }
        main.insertBefore(torrent.linkElement, main.firstChild);
        //currentItem.style.width = (parseInt(window.getComputedStyle(currentItem).width) + parseInt(window.getComputedStyle(torrent.linkElement).width) + 50) + 'px';
    }
    if (!extensionOptions.categorizeTvShows) {
        return;
    }
    var tvShowsCount = tvShows.length;
    if (!tvShowsCount) {
        return;
    }

    tvShows.sort(function (a, b) {
        return a.torrent.compareTo(b.torrent);
    });
    for (i=tvShowsCount-1;i>=0;i--) {
        results.insertBefore(tvShows[i].row, results.firstChild);
    }
    var lastGroup=[-1];
    var firstShow=tvShows[0];
    var lastShow=null;
    var sep;
    for (i=tvShowsCount-1;i>=0;i--) {
        var tvShow=tvShows[i];
        var group = tvShow.torrent.tvShow.getSortArray();
        var cmp = Utils.Arrays.compareTo(group, lastGroup);
        if (cmp != 0) {
            firstShow = tvShow;
            lastShow = tvShows[i+1];
            results.insertBefore(tvShow.row, results.firstChild);
            lastGroup = group;
        }
    }
    tvShows.reverse();
    sep = document.createElement("dl");
    sep.style.fontWeight = 'bold';
    sep.style.backgroundColor = '#004080';
    sep.innerHTML = "<dt style='color: #fff'>Highest Seeded Tv Shows</dt><dd></dd>";
    results.insertBefore(sep, firstShow.row);
    sep = document.createElement("dl");
    sep.style.fontWeight = 'bold';
    sep.style.backgroundColor = '#004080';
    sep.innerHTML = "<dt style='color: #fff'>Remaining Tv Shows</dt><dd></dd>";
    results.insertBefore(sep, lastShow.row);

    for (i=tvShowsCount-1;i>=0;i--) {
    //for (i=0;i<tvShowsCount;i++) {
        var tvShow=tvShows[i];
        var group = tvShow.torrent.tvShow.getSortArray();
        var cmp = Utils.Arrays.compareTo(group, lastGroup);
        if (cmp != 0) {
            sep = document.createElement("dl");
            sep.style.fontWeight = 'bold';
            sep.style.backgroundColor = '#0060bf';
            sep.innerHTML = "<dt style='color: #fff'>" + tvShow.torrent.tvShow.toString() + "</dt><dd></dd>";
            results.insertBefore(sep, tvShow.row);
            lastGroup = group;
        }
    }
}

function processPage(run) {
    run         = run || 1;
    var results = document.querySelectorAll('div#main_content > div#similarfiles'),
        total   = results.length;
    if (total) {
        for (var i = 0; i < total; i++) {
            processResults(results[i]);
        }
        return;
    }
    if (run < 100) {

        console.log("Run #" + run + ": Could not find Results... Retrying in 1s");
        setTimeout(function () {
            processPage(run + 1);
        }, 1000);
    } else {
        console.warn("Could not find Results... giving up");
        debugger;
    }
}

extensionOptions.initialize();

var page     = "other",
    pathName = location.pathname.replace(/\//g, '');

if (pathName.length === 40) {
    page = "torrent";
} else if (pathName == "") {
    page = "home";
} else {
    var match = pathName.match(/^(search|any|my|verified|i$|i\/)/i);
    if (match) {
        page = match[1];
    }
}

if (page === "torrent") {
    var name    = document.querySelector('.download h2 span').innerHTML.replace(/<[^>]*>/g, '');
    var torrent = new Torrent(pathName, name, true);
    document.querySelector('.download dl').insertAdjacentElement('afterend', torrent.linkElement);
} else if (page !== "other") {
    processPage();
}