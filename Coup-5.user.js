// ==UserScript==
// @name            Coup d'Bungie 5
// @namespace       https://github.com/Shou-/Coup-5
// @description     Personlize your bungie.net experience
// @version         5.5.108
// @include         http*://*bungie.net/*
// @exclude         http*://*bungie.net/*createpost.aspx*
// @exclude         http*://*bungie.net/Account/Playtest/*
// @author          Shou
// @copyright       2012, Shou
// @license         (CC) Attribution Non-Commercial Share Alike; http://creativecommons.org/licenses/by-nc-sa/3.0/
// ==/UserScript==

// About:
// Special thanks to Dazarobbo for hosting the server and writing the first
// Coup-5 script, the Coup group for being awesome and to YOU for using this
// script!

// TODO:
// - Coup saving.
//      - Coup style exporting and importing.
// - Improved UI (minimalist, collapse, convenience).
//      - About page.
//      - Report page.
// - Cache
//      - Works as expected?
// - Ignore list
//      - Whitelisting.
//      - "Permanent cache"
//      - Make a generic function for both the cache and ignore list instead of
//        two that do the same thing with different keys.
// - Updater?
// - Registration
//      - Make sure it is fail-safe.
//          - On Settings page check for save message and store something in
//            localStorage then check with interval.
// - Reporting
// - Sanitize input
//      - Publishing?
// - Clean codebase.
//      - Not done yet!

// XXX:

// FIXME:

// Vim:
// :set expandtab
// :set foldenable

// {{{ Debugging

// Console :: Object
var Console = {
    // Log :: String -> IO ()
    Log:function(a){
        if(Coup.Debug){
            console.log(a);
        }
    }
}

// }}}

// {{{ Utils

// | Curry a function.
// cu :: (a -> b -> c) -> (b -> c)
function cu(f, a){
    return function(b){ return f(a, b); }
}

// | Compose two functions.
// co :: (b -> c) -> (a -> b) -> c
function co(f, g){
    return function(a){ return f(g(a)); }
}

// | Flip a function's arguments.
// flip :: (a -> b -> c) -> (b -> a -> c)
function flip(f){
    return function(y, x){ return f(x, y); }
}

// take :: String -> Int -> String
function take(str, n){
    return str.substr(0, n);
}

// init :: [a] -> [a]
function init(xs){
    return xs.slice(0, xs.length - 1);
}

// elem :: a -> [a] -> Bool
function elem(x, xs){
    var b = false;
    for (var i = 0; i < xs.length; i++) if (x === xs[i]){ b = true; break; }
    return b;
}

// intersect :: [a] -> [a] -> [a]
function intersect(xs, ys){
    var tmp = [];
    for (var i = 0; i < xs.length; i++) if (elem(xs[i], ys)) tmp.push(xs[i]);
    return tmp;
}

// listDiff :: [a] -> [a] -> [a]
function listDiff(xs, ys){
    var tmp = [];
    for (var i = 0; i < xs.length; i++) if (!elem(xs[i], ys)) tmp.push(xs[i]);
    return tmp;
}

// getPOSIXTime :: IO Int
function getPOSIXTime(){
    return Math.round((new Date()).getTime() / 1000);
}

// id :: a -> a
function id(x){ return x; }

// filter :: [a] -> (a -> Bool) -> [a]
function filter(xs, f){
    var tmp = [];
    for (var i = 0; i < xs.length; i++) if (f(xs[i])) tmp.push(xs[i]);
    return tmp;
}

// toHex :: String -> Int
function toHex(s){
    s = s.toString().toLowerCase().replace(/[^a-f0-9]/g,"");
    if(s.length == 3){
        s = s[0].concat(s[0],s[1],s[1],s[2],s[2]);
    }
    return parseInt(s,16);
}

// toRGB :: Int -> (Int, Int, Int)
function toRGB(n){
    var r = (n & 0xff0000) >> 16;
    var g = (n & 0x00ff00) >> 8;
    var b = (n & 0x0000ff);
    return { R:r, G:g, B:b }
}

// insert :: (Obj -> Bool) -> a -> [Obj] -> [Obj]
function insert(f, a, o){
    var b = false;
    for (var i = 0; i < o.length; i++){
        if (f(o[i])){
            o[i] = a;
            b = true;
        }
    }
    if (!b) o.push(a);
    return o;
}

// keys :: Obj -> [a]
function keys(o){
    var tmp = [];
    for (k in o) tmp.push(k);
    return tmp;
}

// merge :: Obj -> Obj -> Obj
function merge(o, p){
    for (k in o)
        if ( typeof o[k] === "object" && typeof p[k] === "object" )
            p[k] = merge(o[k], p[k]);
        else
            p[k] = o[k];
    return p;
}

// traverse :: [k] -> ([k] -> a -> b) -> Obj -> Obj
function traverse(ks, f, tree){
    for (k in tree){
        if (typeof tree[k] === "object" && tree[k] !== null)
            tree[k] = traverse( ks.concat(k), f
                              , tree[k]
                              );
        else tree[k] = f(ks.concat(k), tree[k]);
    }
    return tree;
}

// speedcore :: String -> Obj -> [Obj]
function speedcore(tagname, attrs, childs){
    var e = document.createElement(tagname);
    for (k in attrs) e[k] = attrs[k];
    for (var i = 0; i < childs.length; i + 3){
        var el = speedcore( childs[i]
                          , childs[i + 1]
                          , childs[i + 2]
                          )
        e.appendChild(el);
    }
    return e;
}

// triggerMouseEvent :: String -> DOMObj -> IO ()
function triggerMouseEvent(et, o){
    var evt = document.createEvent("MouseEvents");
    evt.initEvent(et, true, true);
    evt.eventName = et;
    o.dispatchEvent(evt);
}

// getSelectedValue :: DOMObj -> DOMObj
function getSelectedValue(o){
    for (var i = 0; i < o.children.length; i++)
        if (o.children[i].selected) return o.children[i].value;
}

// parseBool :: String -> Bool
function parseBool(s){
    if (s === "true") return true;
    else return false;
}

// }}}

// {{{ Data

// {{{ Maybe

// Just :: a -> Maybe a
function Just(x){
    this.Just = x;
}

function Nothing(){}

// Nothing :: Maybe a
var Nothing = new Nothing();

// isJust :: Maybe a -> Bool
function isJust(mx){
    if ("Just" in mx) return true;
    else return false;
}

// fromJust :: Maybe a -> a
function fromJust(mx){
    return mx.Just;
}

// maybe :: b -> (a -> b) -> Maybe a -> b
function maybe(b, f, ma){
    if (isJust(ma)) return f(fromJust(ma));
    else return b;
}

// maybeParse :: String -> Maybe a
function maybeParse(s){
    try {
        return new Just(JSON.parse(s));
    } catch(e){
        return Nothing;
    }
}

// maybeStringify :: a -> Maybe String
function maybeStringify(a){
    try {
        return new Just(JSON.stringify(s));
    } catch(e){
        return Nothing;
    }
}

// toMaybe :: a -> Maybe a
function toMaybe(x){
    if (x === undefined || x === null) return Nothing;
    else return new Just(x);
}

// listToMaybe :: [a] -> Maybe a
function listToMaybe(xs){
    if (xs.length > 0) return new Just(xs[0]);
    else return Nothing;
}

// }}}

// {{{ Either

function Right(x){
    this.Right = x;
}

function Left(x){
    this.Left = x;
}

// isRight :: Either a b -> Bool
function isRight(e){
    if ("Right" in e) return true;
    else return false;
}

// isLeft :: Either a b -> Bool
function isLeft(e){
    if ("Left" in e) return true;
    else return false;
}

// fromRight :: Either a b -> b
function fromRight(e){
    return e.Right;
}

// fromLeft :: Either a b -> b
function fromLeft(e){
    return e.Left;
}

// either :: (a -> c) -> (b -> c) - Either a b -> c
function either(f, g, e){
    if (isRight(e)) return g(fromRight(e));
    else if (isLeft(e)) return f(fromLeft(e));
}

// }}}

// {{{ Styles

var emptyStyles = (new Publish (
      null
    , null
    , new Titlebar(
          new Text(null, null, null, null)
        , new Text(null, null, null, null)
        , new Text(null, null, null, null)
        , new Text(null, null, null, null)
        , new TitleBackground( null, null, null, null
                             , null
                             )
        , new Border(null, null)
        , new Text(null, null, null, null)
        )
    , new Avatar(null, null, new Border(null, null))
    , new Post( [ new PostBackground( null, null, null
                                    , null, null, null
                                    , null, null
                                    )
                ]
              )
    , new Quote(
          null
        , null
        , new QText(null, null, null)
        , new Border(null, null)
        )
    )).Data;

// }}}

// }}}

// {{{ Browser

var Browser = {
    Memory:{
        Type:localStorage['coup5storagetype'],

        Set:function(name, value){
            Console.Log("Setting value (" + value + ") under name (" + name + ")");
            if(this.Type){
                try {
                    GM_setValue(name, value);
                } catch(e) {
                    alert('GreaseMonkey storage not supported by your userscript engine.');
                }
            } else {
                localStorage.setItem(name, value);
            }
            Console.Log("Finished setting value (" + value + ") under name (" + name + ")");
        },

        Get:function(name, defaultValue){
            Console.Log("Getting value named (" + name + ")");
            if(!this.Exists(name)){
                Console.Log(name + " was not found. Returning default value (" + defaultValue + ")");
                return defaultValue;
            }
            if(this.Type){
                try {
                    var val = GM_getValue(name);
                } catch(e) {
                    alert('GreaseMonkey storage not supported by your userscript engine.');
                }
            } else {
                var val = localStorage.getItem(name);
            }
            Console.Log("Found value named (" + name + "). Returning value (" + val + ")");
            return val;
        },

        Delete:function(name){
            Console.Log("Removing value named (" + name + ")");
            if(this.Type){
                try {
                    GM_deleteValue(name);
                } catch(e) {
                    alert('GreaseMonkey storage not supported by your userscript engine.');
                }
            } else {
                localStorage.removeItem(name);
            }
            Console.Log("Finished removing value named (" + name + ")");
        },

        Exists:function(name){
            Console.Log("Checking if value named (" + name + ") exists");
            if(this.Type){
                try {
                    var temp = GM_listValues();
                    var list = new Array();

                    for(i = 0; i < temp.length; i++) {
                        list[temp[i]] = true;
                    }
                    delete temp;
                } catch(e) {
                    alert('GreaseMonkey storage not supported by your userscript engine.');
                }
            } else {
                var list = localStorage;
            }
            if(list[name]){
                Console.Log("Value named (" + name + ") exists");
                return true;
            }
            Console.Log("Value named (" + name + ") does not exist");
            return false;
        },

        DeleteAll:function(){
            Console.Log("Deleting all values");
            if(this.Type){
                try {
                    var temp = GM_listValues();

                    for(i = 0; i < temp.length; i++) {
                        GM_deleteValue(temp[i]);
                    }
                } catch(e) {
                    alert('GreaseMonkey storage not supported by your userscript engine.');
                }
            } else {
                localStorage.clear();
            }
            Console.Log("Finished deleting all values");
        }
    },
    SupportsCoupDBungie:function(){
        Console.Log("Determining whether browser supports Coup-5-Mod");
        if(localStorage && XMLHttpRequest && JSON){
            Console.Log("Browser supports Coup-5-Mod");
            return true;
        }
        Console.Log("Browser does not support Coup-5-Mod");
        return false;
    },
    XHR:function(method, url, async, headers, onload, onerror, onreadystatechange){
        this._Init(method, url, async, headers, onload, onerror, onreadystatechange);
    },
    Type:{
        Get:function(){
            if (navigator.vendor === "Google Inc.") return "webkit";
            else if (window.opera) return "opera";
            else return "mozilla";
        },
        ScriptUrl:function(){
            var browser = Browser.Type.Get();

            if (browser === "webkit")
                return "https://github.com/downloads/Shou-/Coup-5/Coup-5-Mod-Chrome.crx";
            else if (browser === "opera")
                return "https://github.com/downloads/Shou-/Coup-5/Coup-5-Mod-Opera.zip";
            else
                return "https://github.com/Shou-/Coup-5/raw/master/Coup-5-Mod.user.js";
        },
        Platform:function(){
            var browser = Browser.Type.Get();

            if (browser === "webkit") return "Google Chrome";
            else if (browser === "opera") return "Opera";
            else return "Firefox";
        }
    }
}

// }}}

// {{{ Coup

var Coup = { Debug: true

           , Version: "5.6"
             // Platform :: IO String
           , Platform: Browser.Type.Platform()
           , Author: "Shou"
           , AuthorMemberID: 2503535

           , Server: { Hosts: [ "http://test.coup-srv-01.heliohost.org" ]
                     , Method: "POST"
                     , Responses: { OK: 1
                                  , Error: 2
                                  }
                     }
             // Key :: Maybe String
           , Key: function(){
                var str = Browser.Memory.Get("coup5key", "{}");
                try {
                    return new Just(JSON.parse(str)[Coup.Username()]);
                } catch(e){
                    Console.Log("Coup.Key: " + e);
                    return Nothing;
                }
             }
           , Username: function(defaultVal){
                var m = /BungieDisplayName=(.*?)(?:;|$)/i.exec(document.cookie);
                var bool = m != null && m[1] != undefined;
                if (bool) return unescape(m[1]).replace(/&nbsp;/gi, " ");
                else return defaultVal;
             }
           , ValidationString: function(){
                var svs = Browser.Memory.Get("Coup5ValidationString", "{}");
                var vs = "";
                var time = getPOSIXTime();
                try {
                    vo = JSON.parse(svs);
                    if (time < vo.Time) vs = vo.String;
                } catch(e){
                    Console.Log("Coup.ValidationString: " + e);
                }
                return vs;
             }
           , MemberId: function(){
                var smi = Browser.Memory.Get("Coup5MemberId", "{}");
                var mi = Nothing;
                var time = getPOSIXTime();
                try {
                    mio = JSON.parse(smi);
                    if (time < mio.Time) mi = new Just(mio.Id);
                } catch(e){
                    Console.Log("Coup.MemberId: " + e);
                }
                return mi;
             }
           , Ignore: { List: function(){
                        var tmp = Browser.Memory.Get(this.Key, "[]");
                        try {
                            return JSON.parse(tmp);
                        } catch(e){
                            Console.Log("Coup.Ignore.List: " + e);
                            return [];
                        }
                       }
                     , Add: function(style){
                        var list = this.List();
                        var f = function(o){
                            return (o["Username"] === style.Username);
                        }
                        list = JSON.stringify(insert(f, style, list));
                        Browser.Memory.Set(this.Key, list);
                       }
                     , Rem: function(username){
                        var list = this.List();
                        delete list[username];
                        Browser.Memory.Set(this.Key, list);
                       }
                     , Key: "Coup5Ignore"
                     }
           , Cache: { List: function(){
                        var tmp = Browser.Memory.Get(this.Key, "[]");
                        try {
                            return JSON.parse(tmp);
                        } catch(e){
                            Console.Log("Coup.Cache.List: " + e);
                            return [];
                        }
                      }
                    , Add: function(style){
                        var list = this.List();
                        var f = function(o){
                            return (o["Username"] === style.Username);
                        }
                        list = JSON.stringify(insert(f, style, list));
                        Browser.Memory.Set(this.Key, list);
                        Browser.Memory.Set( this.TimeKey
                                          , JSON.stringify(getPOSIXTime())
                                          );
                      }
                    , Clear: function(){
                        Browser.Memory.Set(this.Key, "[]");
                      }
                    , Autoclear: function(){
                        var stime = Browser.Memory.Get(this.TimeKey, '0');
                        var time;
                        var newtime = getPOSIXTime();
                        try {
                            time = JSON.parse(stime);
                        } catch(e){
                            time = 0;
                        }
                        Console.Log( "Coup.Cache.Autoclear: Comparing times " +
                                     newtime + " > " + (time + this.Time)
                                   );
                        if (newtime > time + this.Time){
                            this.Clear();
                            Console.Log("Coup.Cache.Autoclear: Cache cleared.");
                        }
                      }
                    , Usernames: function(){
                        var list = this.List();
                        var tmp = [];
                        for (var i = 0; i < list.length; i++)
                            tmp.push(list[i].Username);
                        return tmp;
                      }
                    , Time: 300
                    , Key: "Coup5Cache"
                    , TimeKey: "Coup5CacheTime"
                    }
           }

// }}}

// {{{ Post functions/objects

// SendPost :: PostObject -> (String -> IO ()) -> IO ()
function SendPost(o, f){
    var xhr;
    var url = Coup.Server.Hosts[0] + o.Path;
    var data = JSON.stringify(o.Data);

    Console.Log(url);
    Console.Log(data);
    var update = function(state, status, response){
        if (state == 4 && status == 200){
            f(response);
        }
        else {
            var readyState;
            switch(state){
                case 0: readyState = "UNSENT"; break;
                case 1: readyState = "OPENED"; break;
                case 2: readyState = "HEADERS_RECEIVED"; break;
                case 3: readyState = "LOADING"; break;
                case 4: readyState = "DONE"; break;
            }
            var reason = "{ readyState: " + readyState;
            reason += ", status: " + status + " }";
            Console.Log("SendPost: " + reason);
        }
    }

    try {
        xhr = new GM_xmlhttpRequest(
            { method: Coup.Server.Method
            , url: url
            , data: "json=" + data
            , synchronous: false
            , onreadystatechange: function(r){
                update(r.readyState, r.status, r.responseText);
              }
            , headers: { "Content-Type": "application/x-www-form-urlencoded" }
            }
        );
        Console.Log("SendPost: Using GM XHR.");
    } catch(e){
        Console.Log("SendPost: Using built-in XHR (" + e + ").");
        xhr = new XMLHttpRequest();
        xhr.onreadystatechange = function(r){
            update(r.readyState, r.status, r.responseText);
        }
        xhr.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
        xhr.open(Coup.Server.Method, url, true);
        xhr.send("json=" + data);
    }
}

// {{{ Objects

// {{{ Publishing

// Publish :: String
//         -> String
//         -> TitlebarObject
//         -> AvatarObject
//         -> PostObject
//         -> QuoteObject
//         -> PostObject
function Publish(u, k, t, a, p, q){
    this.Path = "/API/Services/Styles/Publish";
    this.Data = {};
    this.Data.Username = u;
    this.Data.Key = k;
    this.Data.Titlebar = t;
    this.Data.Avatar = a;
    this.Data.Post = p;
    this.Data.Quote = q;
}

// Titlebar :: TextObject
//          -> TextObject
//          -> TextObject
//          -> TextObject
//          -> TitleBackgroundObject
//          -> BorderObject
//          -> TextObject
//          -> TitlebarObject
function Titlebar(u, t, m, g, b, o, r, a){
    this.Username = u;
    this.Title = t;
    this.Message = m;
    this.Group = g;
    this.Background = b;
    this.Border = o;
    this.More = r;
    this.RemoveBars = a;
}

// Avatar :: String -> Float -> BorderObject -> AvatarObject
function Avatar(i, o, b){
    this.Image = i;
    this.Opacity = o;
    this.Border = b;
}

// Post :: [PostBackgroundObject]
//      -> String
//      -> String
//      -> Float
//      -> LinksObject
//      -> PostObject
function Post(b, f, c, o, l){
    this.Backgrounds = b;
    this.Font = f;
    this.Color = c;
    this.Opacity = o;
    this.Links = l;
}

// Quote :: Float -> String -> QTextObject -> BorderObject -> QuoteObject
function Quote(o, b, t, r){
    this.Opacity = o;
    this.BackgroundColor = b;
    this.Text = t;
    this.Border = r;
}

// Text :: Bool -> String -> String -> Float -> TextObject
function Text(s, t, c, o){
    this.Show = s;
    this.Text = t;
    this.Color = c;
    this.Opacity = o;
}

// TitleBackground :: String
//                 -> Float
//                 -> String
//                 -> String
//                 -> String
//                 -> TitleBackgroundObject
function TitleBackground(i, o, c, gl, gr){
    this.Image = i;
    this.Opacity = o;
    this.Color = c;
    this.GradientLeft = gl;
    this.GradientRight = gr;
}

// PostBackground :: String
//                -> String
//                -> String
//                -> String
//                -> Float
//                -> String
//                -> String
//                -> String
//                -> PostBackgroundObject
function PostBackground(c, gl, gr, i, o, ir, ia, ip){
    this.Color = c;
    this.GradientLeft = gl;
    this.GradientRight = gr;
    this.Image = i;
    this.Opacity = o;
    this.ImageRepeat = ir;
    this.ImageAttachment = ia;
    this.ImagePosition = ip;
}

// Border :: String -> String -> BorderObject
function Border(s, c){
    this.Style = s;
    this.Color = c;
}

// QText :: Float -> String -> String -> QuoteTextObject
function QText(o, f, c){
    this.Opacity = o;
    this.Font = f;
    this.Color = c;
}

// Links :: String -> Float -> LinksObject
function Links(c, o){
    this.Color = c;
    this.Opacity = o;
}

// }}}

// {{{ Reporting

// Report :: String -> String -> String -> String -> Int -> ReportObject
function Report(u, k, s, r, e){
    this.Path = "/API/Services/User/Report";
    this.Data = {};
    this.Data.Username = u;
    this.Data.Key = k;
    this.Data.Subject = s;
    this.Data.Reason = r;
    this.Data.Service = e;
}

// }}}

// {{{ Register

// Register :: String -> Int -> RegisterObject
function Register(x){
    this.Path = "/API/Services/User/Register";
    this.Data = {};
    if (typeof x === "string")
        this.Data.Username = x;
    else if (typeof x === "number")
        this.Data.MemberId = x;
    else
        Console.Log("FetchKey: `x' is not a number or string");
}

function FetchKey(x){
    this.Path = "/API/Services/User/FetchKey";
    this.Data = {};
    if (typeof x === "string")
        this.Data.Username = x;
    else if (typeof x === "number")
        this.Data.MemberId = x;
    else
        Console.Log("FetchKey: `x' is not a number or string");
}

// }}}

// {{{ GetStyles

// GetStyles :: Bool -> [UserObject] -> GetStylesObject
function GetStyles(o, u){
    this.Path = "/API/Services/Styles/GetStyles";
    this.Data = {};
    this.Data.OmitNulls = o;
    this.Data.Users = u;
}

// User :: String -> Int -> UserObject
function User(u, i){
    this.Username = u;
    this.StyleId = i;
}

// }}}

// }}}

// }}}

// {{{ Interface

// {{{ Style
var style = "\
#Coup5 form input, #Coup5 form select {\
    background-color: #1b1d1f;\
    color: #b0b0b0;\
    border: 1px solid #707070;\
    font-size: 9pt;\
    font-family: arial;\
    margin: 4px;\
}\
\
#Coup5 form input[type='submit']:hover, #Coup5 form select:hover,\
#Coup5 form input[type='button']:hover {\
    background-color: #17668a;\
    border: 1px solid #56aacd;\
    cursor: pointer;\
}\
\
ul.leftside { height: auto !important }\
\
.Coup5Tab {\
    padding: 0 10px;\
    cursor: pointer;\
    display: table-cell;\
    text-align: center;\
}\
\
.Coup5Tab:hover {\
    background-color: #17668a;\
}\
\
.Coup5Divider td {\
    border-top: 1px solid #d0d0d0;\
}\
\
#Coup5UI tr:nth-child(odd) {\
    background-color: rgba(255,255,255,0.03);\
}\
\
#Coup5UI tr {\
    height: 27px;\
}\
";
// }}}

// spawnIgnore :: IO ()
function spawnIgnore(){
    var aheader = this.parentNode.parentNode.parentNode.parentNode.children[0];
    var title = aheader.children[0].children[0].title;
    var text = aheader.children[0].children[0].textContent;
    var username = title || text;
    Console.Log("spawnIgnore: Spawning UI for `" + username + "'.");

    var ui = mkUI(username, 1);
    var oui = document.getElementById("Coup5IgnoreUI");
    if (oui){
        oui.parentNode.replaceChild(ui, oui);
    } else {
        var floater = mkFloater();
        floater.children[0].children[1].appendChild(ui);
        document.body.appendChild(floater);
    }
}

// {{{ Styling

// mkStyler :: IO DOMObj
function mkStyler(tree){
    var ui = document.createElement("table");
    var statets = [];
    var recurse = function(ts, a){
        var curtes;
        if (ts.length > 0) curtes = ts[ts.length - 1];
        else curtes = "";
        var wrap = document.createElement("tr");
        var title = document.createElement("td");
        var inputd = document.createElement("td");
        var input;
        if (["Text", "Image"].indexOf(curtes) != -1 && ts[0] != "Quote"){
            input = document.createElement("input");
            input.value = a;
        } else if (["Show", "RemoveBars"].indexOf(curtes) != -1){
            input = document.createElement("select");
            seld = document.createElement("option");
            seld.value = a;
            seld.textContent = a;
            opt = document.createElement("option");
            opt.value = !a;
            opt.textContent = !a;
            input.appendChild(seld);
            input.appendChild(opt);
        } else if ("Opacity" === curtes){
            input = document.createElement("input");
            input.type = "range";
            input.min = 0.0;
            input.max = 1.0;
            input.step = 0.1;
            input.value = (a === null || a === undefined) ? 1 : a;
            input.title = "Opacity: 1.0";

            input.addEventListener("change", function(){
                if (this.value > 1.0) this.value = 1.0;
                else if (this.value < 0.0) this.value = 0.0;
                this.title = "Opacity: " + this.value;
            });
        } else if ("Style" === curtes){
            input = document.createElement("select");
            var vals = [ "solid"
                       , "dotted"
                       , "dashed"
                       , "double"
                       , "groove"
                       , "ridge"
                       , "inset"
                       , "outset"
                       ]
            for (var i = 0; i < vals.length; i++){
                var e = document.createElement("option");
                e.textContent = vals[i];
                e.value = vals[i];
                if (vals[i] === a) e.selected = true;
                input.appendChild(e);
            }
        } else if ("ImageRepeat" === curtes){
            input = document.createElement("select");
            var vals = ["repeat", "repeat-x", "repeat-y", "no-repeat"];
            for (var i = 0; i < vals.length; i++){
                var e = document.createElement("option");
                e.textContent = vals[i];
                e.value = vals[i];
                if (vals[i] === a) e.selected = true;
                input.appendChild(e);
            }
        } else if ("ImageAttachment" === curtes){
            input = document.createElement("select");
            var vals = ["scroll", "fixed"];
            for (var i = 0; i < vals.length; i++){
                var e = document.createElement("option");
                e.textContent = vals[i];
                e.value = vals[i];
                if (vals[i] === a) e.selected = true;
                input.appendChild(e);
            }
        } else if ("Font" === curtes){
            input = document.createElement("select");
            var vals = [ "arial"
                       , "helvetica"
                       , "times new roman"
                       , "courier"
                       , "verdana"
                       , "tahoma"
                       , "comic sans ms"
                       , "impact"
                       , "georgia"
                       , "palatino"
                       ]
            for (var i = 0; i < vals.length; i++){
                var e = document.createElement("option");
                e.textContent = vals[i];
                e.value = vals[i];
                if (vals[i] === a) e.selected = true;
                input.appendChild(e);
            }
        } else if ("Key" === curtes){
            input = document.createElement("span");
            var inp = document.createElement("input");

            inp.type = "password";
            inp.style.cursor = "pointer";
            inp.value = maybe("", id, toMaybe(a));

            inp.addEventListener("mouseover", function(){
                this.type = "text";
            });
            inp.addEventListener("mouseout", function(){
                this.type = "password";
            });
            var save = document.createElement("input");
            save.type = "button";
            save.value = "Save";

            save.addEventListener("click", function(){
                var str = Browser.Memory.Get("coup5key", "{}");
                var obj;
                try {
                    obj = JSON.parse(str);
                } catch(e){
                    obj = {};
                }
                obj[Coup.Username()] = this.previousSibling.value;
                Browser.Memory.Set("coup5key", JSON.stringify(obj));
            });

            input.appendChild(inp);
            input.appendChild(save);
        } else if ("Register" === curtes){
            input = document.createElement("span");
            var register = document.createElement("input");
            var regtype = document.createElement("select");
            var regnew = document.createElement("option");
            var regfetch = document.createElement("option");
            var msg = document.createElement("div");

            register.type = "button";
            register.value = "Register";
            regnew.textContent = "New user";
            regfetch.textContent = "Fetch key";
            msg.id = "Coup5RegisterHint";
            msg.style.cursor = "pointer";
            msg.title = "Click here to hide this text";

            register.addEventListener("click", function(){
                var newuser = false;
                if (regtype.children[0].selected) newuser = true;
                var f = function(o){
                    try {
                        o = JSON.parse(o);
                    } catch(e){
                        o = {};
                        Console.Log("Register: " + e);
                    }
                    if (o.Status == 1){
                        var valo = JSON.stringify({ "String": o.ValidationString
                                                  , "Time": getPOSIXTime() + 10
                                                  });
                        Browser.Memory.Set("Coup5ValidationString", valo);
                    } else {
                        msg.textContent = "Server error: " + o.Reason;
                        msg.style.color = "#960050";
                    }
                    msg.textContent = [ "Setting validation string and getting"
                                      , "MemberId..."
                                      ].join(' ');
                    msg.style.color = "#c47f2c";
                    setValidationString();
                    getMemberId();

                    var idchecker = setInterval(function(){
                        var mid = Coup.MemberId();
                        maybe(null, function(id){
                            clearInterval(idchecker);
                            msg.textContent = [ "MemberId received"
                                              , "(" + id + "),"
                                              , "attempting to register..."
                                              ].join(' ');
                            msg.style.color = "#c47f2c";
                            var obj;
                            if (newuser) obj = new Register(id);
                            else obj = new FetchKey(id);
                            SendPost(obj, storeKey);
                            var e = document.getElementById(
                                "Coup5MemberIdFrame"
                            );
                            e.parentNode.removeChild(e);
                            Browser.Memory.Delete("Coup5MemberId");
                        }, mid);
                    }, 108); // moro!!
                    var vschecker = setInterval(function(){
                        var uvs = Browser.Memory.Get( "Coup5ValidationBool"
                                                    , "{}"
                                                    );
                        maybe(null, function(evs){
                            either(function(s){
                                clearInterval(vschecker);
                                msg.textContent = s;
                                msg.style.color = "#960050";
                            }, function(s){
                                clearInterval(vschecker);
                                msg.textContent = s;
                                msg.style.color = "#c47f2c";
                            }, evs);
                        }, maybeParse(uvs));
                    }, 108);
                    setTimeout(function(){
                        clearInterval(idchecker);
                        clearInterval(vschecker);
                        var e = document.getElementById("Coup5ValidationFrame");
                        e.parentNode.removeChild(e);
                        if (!Browser.Memory.Get("Coup5ValidationBool", false)){
                            msg.textContent =
                                "Automatic registration timed out.";
                            msg.style.color = "#960050";
                            //manualRegistration();
                        }
                        Browser.Memory.Delete("Coup5ValidationString");
                        Browser.Memory.Delete("Coup5ValidationBool");
                    }, 20000);
                }
                var mid = Coup.MemberId();
                var obj;
                var bool = maybe(true, function(id){
                    Console.Log("FetchKey: " + id);
                    if (newuser) obj = new Register(id);
                    else obj = new FetchKey(id);
                    SendPost(obj, storeKey);

                    return false;
                }, mid);
                if (bool){
                    Console.Log("FetchKey: " + Coup.Username());
                    if (newuser) obj = new Register(Coup.Username());
                    else obj = new FetchKey(Coup.Username());
                    msg.textContent = "Requesting validation string...";
                    msg.style.color = "#c47f2c";
                    SendPost(obj, f);
                }
            });
            msg.addEventListener("click", function(){
                this.textContent = "";
            });

            regtype.appendChild(regnew);
            regtype.appendChild(regfetch);
            input.appendChild(regtype);
            input.appendChild(register);
            input.appendChild(msg);
        } else if ([ "Color"
                   , "BackgroundColor"
                   , "GradientLeft"
                   , "GradientRight"
                   , "ImagePosition" ].indexOf(curtes) != -1){
            input = document.createElement("input");
            input.value = a;
            input.addEventListener("change", function(){
                //
            });
        } else {
            input = document.createElement("td");
            title.colspan = "2";
            wrap.className = "Coup5Divider";

            var toggleSiblings = function(e){
                if (e.nextSibling != null
                    && e.nextSibling.className != "Coup5Divider"
                    && e.nextSibling.style.display != "none"){
                    e.nextSibling.style.display = "none";
                    toggleSiblings(e.nextSibling);
                    e.getElementsByTagName("td")[0].style.fontWeight = "bold";
                } else if (e.nextSibling != null
                           && e.nextSibling.className != "Coup5Divider"){
                    e.nextSibling.style.display = "";
                    toggleSiblings(e.nextSibling);
                    e.getElementsByTagName("td")[0].style.fontWeight = "";
                }
            }

            wrap.addEventListener("click", function(){
                toggleSiblings(this);
            });
        }

        if (ts[0] === "Post" && ts[1] === "Font"){
            var bgswrap = document.createElement("tr");
            var td1 = document.createElement("td");
            var td2 = document.createElement("td");
            var bgsadd = document.createElement("input");

            bgsadd.type = "button";
            bgsadd.value = "add layer";
            bgsadd.addEventListener("click", function(){
                var i = 0;
                var exists = true;
                while (exists){
                    var e = document.getElementsByClassName(i + 1);
                    if (e === null) exists = false;
                    else i++;
                }
                var bgtitle = document.createElement("tr");
                var bgtitletitle = document.createElement("td");
                var bgtitletd2 = document.createElement("td");
                bgtitletitle.textContent = "Post Background " + i;
                bgtitle.appendChild(bgtitletitle);
                bgtitle.appendChild(bgtitletd2);

                //var obj = tree.Data.Post.Backgrounds[0];

                //recurse(["Post", "Background", '' + i], obj);
            });

            bgswrap.appendChild(bgsadd);
            bgswrap.appendChild(td2);
            ui.appendChild(bgswrap);
        }

        var diff = listDiff(init(ts), statets);
        if (diff.length > 0){
            wrap.className = "Coup5Divider";

            var toggleSiblings = function(e){
                if (e.nextSibling != null
                    && e.nextSibling.className != "Coup5Divider"
                    && e.nextSibling.style.display != "none"){
                    e.nextSibling.style.display = "none";
                    toggleSiblings(e.nextSibling);
                    e.getElementsByTagName("td")[0].style.fontWeight = "bold";
                } else if (e.nextSibling != null
                           && e.nextSibling.className != "Coup5Divider"){
                    e.nextSibling.style.display = "";
                    toggleSiblings(e.nextSibling);
                    e.getElementsByTagName("td")[0].style.fontWeight = "";
                }
            }
            title.addEventListener("click", function(){
                //toggleSiblings(this.parentNode);
            });
        }
        statets = init(ts);

        title.textContent = ts.join(' ');
        input.className = curtes;

        if (["Titlebar", "Post", "Backgrounds", ""].indexOf(curtes) == -1){
            inputd.appendChild(input);
            wrap.appendChild(title);
            wrap.appendChild(inputd);
            ui.appendChild(wrap);
        }
    }

    var trheader = document.createElement("tr");
    var td1 = document.createElement("td");
    var td2 = document.createElement("td");
    var submit = document.createElement("input");
    var pubstatus = document.createElement("div");
    td1.textContent = "Collapse all";
    trheader.style.cursor = "pointer";
    trheader.style.borderBottom = "1px solid #d0d0d0";
    submit.type = "submit";
    submit.value = "Submit";
    pubstatus.id = "Coup5PublishStatus";
    pubstatus.style.cursor = "pointer";
    trheader.addEventListener("click", function(){
        var toggler = this;
        var toggleNext = function(e){
            if (e.nextSibling !== null && e.nextSibling.style.display !== "none"){
                e.nextSibling.style.display = "none";
                toggleNext(e.nextSibling);
                toggler.style.fontWeight = "bold";
            } else {
                e.nextSibling.style.display = "";
                toggleNext(e.nextSibling);
                toggler.style.fontWeight = "";
            }
        }
        toggleNext(this);
    });
    pubstatus.addEventListener("click", function(){
        this.textContent = "";
    });
    trheader.appendChild(td1);
    trheader.appendChild(td2);
    ui.appendChild(trheader);

    traverse([], recurse, tree);

    ui.appendChild(submit);
    ui.appendChild(pubstatus);
    ui.style.width = "100%";
    ui.style.borderSpacing = "0";

    return ui;
}

// makeGetStyles :: [String] -> [User]
function makeGetStyles(us){
    var users = [];
    for (var i = 0; i < us.length; i++) users.push(new User(us[i], 0));
    var obj = new GetStyles(true, users);
    return obj;
}

// stylePost :: Styles -> DOMObj -> IO ()
function stylePost(s, o){
    Console.Log("stylePost: Styling post of " + s.Username);
    var avatar;
    var post;
    var titlebar;
    var quotes;

    o.style.width = "670px";
    o.style.backgroundColor = "transparent";
    o.style.position = "relative";

    // Avatar
    if ("Avatar" in s){
        avatar = o.children[1].children[0].children[0];
        if ("Image" in s.Avatar)
            avatar.src = s.Avatar.Image;
        if ("Opacity" in s.Avatar)
            avatar.style.opacity = s.Avatar.Opacity;
        if ("Border" in s.Avatar){
            if ("Style" in s.Avatar.Border)
                avatar.style.borderStyle = s.Avatar.Border.Style;
            if ("Color" in s.Avatar.Border){
                avatar.style.width = "88px";
                avatar.style.height = "88px";
                avatar.style.borderWidth = "1px";
                avatar.style.borderColor = '#' + s.Avatar.Border.Color;
            }
        }
    }

    // Titlebar
    if ("Titlebar" in s){
        titlebar = o.children[2].children[0]
        if ("Username" in s.Titlebar){
            var username = titlebar.children[0].children[0];
            if ("Show" in s.Titlebar.Username)
                if (!s.Titlebar.Username.Show)
                    username.style.display = "none";
            if ("Text" in s.Titlebar.Username)
                username.textContent = s.Titlebar.Username.Text;
            if ("Color" in s.Titlebar.Username)
                username.style.color = '#' + s.Titlebar.Username.Color;
            if ("Opacity" in s.Titlebar.Username)
                username.style.opacity = s.Titlebar.Username.Opacity;
        }
        if ("Title" in s.Titlebar){
            var title = titlebar.children[2];
            if ("Show" in s.Titlebar.Title)
                if (!s.Titlebar.Title.Show)
                    title.style.display = "none";
            if ("Text" in s.Titlebar.Title)
                title.textContent = s.Titlebar.Title.Text;
            if ("Color" in s.Titlebar.Title)
                title.style.color = '#' + s.Titlebar.Title.Color;
            if ("Opacity" in s.Titlebar.Title)
                title.style.opacity = s.Titlebar.Title.Opacity;
        }
        if ("Message" in s.Titlebar) try {
            var message = titlebar.children[7].children[0];
            if ("Show" in s.Titlebar.Message)
                if (!s.Titlebar.Message.Show)
                    message.style.display = "none";
            if ("Text" in s.Titlebar.Message)
                message.textContent = s.Titlebar.Message.Text;
            if ("Color" in s.Titlebar.Message)
                message.style.color = '#' + s.Titlebar.Message.Color;
            if ("Opacity" in s.Titlebar.Message)
                message.style.opacity = s.Titlebar.Message.Opacity;
        } catch(e){ Console.Log("stylePost: " + e); }
        if ("Group" in s.Titlebar){
            var group = titlebar.children[5].children[0];
            if ("Show" in s.Titlebar.Group)
                if (!s.Titlebar.Group.Show)
                    group.style.display = "none";
            if ("Text" in s.Titlebar.Group)
                group.textContent = s.Titlebar.Group.Text;
            if ("Color" in s.Titlebar.Group)
                group.style.color = '#' + s.Titlebar.Group.Color;
            if ("Opacity" in s.Titlebar.Group)
                group.style.opacity = s.Titlebar.Group.Opacity;
        }
        if ("Background" in s.Titlebar){
            var to = 1.0;
            if ("Image" in s.Titlebar.Background)
                titlebar.style.backgroundImage =
                    "url(" + s.Titlebar.Background.Image + ")";
            if ("Opacity" in s.Titlebar.Background)
                to = s.Titlebar.Background.Opacity;
            if ("Color" in s.Titlebar.Background)
                var rgb = toRGB(toHex(s.Titlebar.Background.Color));
                titlebar.style.backgroundColor =
                    "rgba(" + rgb.R +
                    ", " + rgb.G +
                    ", " + rgb.B +
                    ", " + to + ")";
            if ("GradientLeft" in s.Titlebar.Background
                && "GradientRight" in s.Titlebar.Background)
                titlebar.style.backgroundImage =
                    "-moz-linear-gradient(left, #" +
                    s.Titlebar.Background.GradientLeft +
                    " 0%, #" +
                    s.Titlebar.Background.GradientRight +
                    " 100%)";
        }
        if ("Border" in s.Titlebar){
            if ("Style" in s.Titlebar.Border)
                titlebar.style.borderStyle = s.Titlebar.Border.Style;
            if ("Color" in s.Titlebar.Border){
                titlebar.style.borderWidth = "1px";
                titlebar.style.borderColor = '#' + s.Titlebar.Border.Color;
            }
        }
        if ("More" in s.Titlebar){
            var more = titlebar.children[4];
            var moreButton = titlebar.children[3];
            if ("Show" in s.Titlebar.More)
                if (!s.Titlebar.More.Show)
                    more.style.display = "none";
            if ("Text" in s.Titlebar.More)
                more.textContent = " | " + s.Titlebar.More.Text + ' ';
            if ("Color" in s.Titlebar.More)
                more.style.color = '#' + s.Titlebar.More.Color;
            if ("Opacity" in s.Titlebar.More){
                more.style.opacity = s.Titlebar.More.Opacity;
                moreButton.style.opacity = s.Titlebar.MoreOpacity;
            }
        }
        if ("RemoveBars" in s.Titlebar){
            titlebar.children[1].textContent = "   ";
            titlebar.children[4].textContent =
                "   " + titlebar.children[4].textContent.substr(3);
            titlebar.children[6].textContent = "     ";
        }
    }

    // Post
    if ("Post" in s){
        post = o.children[2].children[2];
        var po = 1.0;
        var font = Nothing;

        if ("Backgrounds" in s.Post){
            for (var i = 0; i < s.Post.Backgrounds.length; i++){
                var e = document.createElement("div");
                e.id = "Coup-5-Background-" + i;
                e.style.position = "absolute";
                e.top = "0px";
                e.style.width = "670px";
                e.style.height = "100%";

                if ("Color" in s.Post.Backgrounds[i])
                    e.style.backgroundColor = '#' + s.Post.Backgrounds[i].Color;
                if ("GradientLeft" in s.Post.Backgrounds[i]
                    && "GradientRight" in s.Post.Backgrounds[i])
                        e.style.backgroundImage =
                            "-moz-linear-gradient(left, #" +
                            s.Post.Backgrounds[i].GradientLeft +
                            " 0%, #" +
                            s.Post.Backgrounds[i].GradientRight +
                            " 100%)";
                if ("Image" in s.Post.Backgrounds[i])
                    e.style.backgroundImage =
                        "url(" + s.Post.Backgrounds[i].Image + ")";
                if ("Opacity" in s.Post.Backgrounds[i])
                    e.style.opacity = s.Post.Backgrounds[i].Opacity;
                if ("ImageRepeat" in s.Post.Backgrounds[i])
                    e.style.backgroundRepeat = s.Post.Backgrounds[i].ImageRepeat;
                if ("ImageAttachment" in s.Post.Backgrounds[i])
                    e.style.backgroundAttachment =
                        s.Post.Backgrounds[i].ImageAttachment;
                if ("ImagePosition" in s.Post.Backgrounds[i])
                    e.style.backgroundPosition =
                        s.Post.Backgrounds[i].imagePosition;

                o.parentNode.insertBefore(e, o.parentNode.children[0]);
            }
        }
        if ("Font" in s.Post){
            post.style.fontFamily = s.Post.Font;
            font = new Just(s.Post.Font);
        }
        if ("Opacity" in s.Post)
            po = s.Post.Opacity;
        if ("Color" in s.Post){
            var rgb = toRGB(toHex(s.Post.Color));
            post.style.color =
                "rgba(" + rgb.R +
                ", " + rgb.G +
                ", " + rgb.B +
                ", " + po + ")";
        }
        if ("Links" in s.Post){
            var links = post.getElementsByTagName("a");
            var lo = 1.0;
            if ("Opacity" in s.Post.Links)
                lo = s.Post.Links.Opacity;
            if ("Color" in s.Post.Links){
                var rgb = toRGB(toHex(s.Post.Links.Color));
                for (var i = 0; i < links.length; i++){
                    links[i].style.color =
                        "rgba(" + rgb.R +
                        ", " + rgb.G +
                        ", " + rgb.B +
                        ", " + lo + ")";
                }
            }
            if (isJust(font))
                for (var i = 0; i < links.length; i++)
                    links[i].style.fontFamily = fromJust(font);
        }
    }

    // Quote
    if ("Quote" in s){
        quote = o.getElementsByClassName("IBBquotedtable");
        var bo = 1.0;
        if ("Opacity" in s.Quote)
            bo = s.Quote.Opacity;
        if ("BackgroundColor" in s.Quote)
            for (var i = 0; i < quote.length; i++){
                var rgb = toRGB(toHex(s.Quote.BackgroundColor));
                quote[i].style.backgroundColor =
                    "rgba(" + rgb.R +
                    ", " + rgb.G +
                    ", " + rgb.B +
                    ", " + bo + ")";
            }
        if ("Text" in s.Quote){
            var to = 1.0;
            if ("Opacity" in s.Quote.Text)
                to = s.Quote.Text.Opacity;
            if ("Font" in s.Quote.Text)
                for (var i = 0; i < quote.length; i++)
                    quote[i].style.fontFamily = s.Quote.Text.Font;
            if ("Color" in s.Quote.Text)
                for (var i = 0; i < quote.length; i++) {
                    var rgb = toRGB(toHex(s.Quote.Text.Color));
                    quote[i].style.color =
                        "rgba(" + rgb.R +
                        ", " + rgb.G +
                        ", " + rgb.B +
                        ", " + to + ")";
                }
        }
        if ("Border" in s.Quote){
            if ("Style" in s.Quote.Border)
                for (var i = 0; i < quote.length; i++)
                    quote[i].style.borderStyle = s.Quote.Border.Style;
            if ("Color" in s.Quote.Border)
                for (var i = 0; i < quote.length; i++)
                    quote[i].style.borderColor = '#' + s.Quote.Border.Color;
        }
    }
}

// applyStyles :: Response Styles -> IO ()
function applyStyles(r){
    try {
        r = JSON.parse(r);
    } catch(e){
        Console.Log("applyStyles: JSON parse error.");
    }
    if (r.Status == 1){
        // Add server loaded styles to cache.
        for (var i = 0; i < r.Users.length; i++){
            Coup.Cache.Add(r.Users[i]);
        }
        var cs = Coup.Cache.List();
        var logins = document.getElementsByClassName("login");
        // Style posts.
        for (var i = 0; i < cs.length; i++){
            for (var j = 0; j < logins.length; j++){
                var username = logins[j].textContent;
                if (cs[i]["Username"] === username){
                    var post = logins[j].parentNode.parentNode.parentNode;
                    stylePost(cs[i], post);
                }
            }
        }
    }
    else Console.Log(r.Reason);
}

// }}}

// {{{ Makers

// mkPost :: IO DOMObj
function mkPost(){
    var e = speedcore(
        "span", {}, [
            "div", { className: "forumpost" }, [
                "div", { className: "clear" }, [],
                "div", { className: "forumavatar" }, [
                    "a", { href: "http://#" }, [
                        "img", { src: "http://#" }, []
                    ]
                ],
                "div", { className: "postbody" }, [
                    "ul", { className: "author_header_block" }, [
                        "li", { className: "login" }, [
                            "a", { textContent: Coup.Username()
                                 , href: "/Account/Profile.aspx"
                                 }, [],
                        ],
                        "li", { textContent: " | " }, [],
                        "li", { className: "title", textContent: "Member" }, [],
                        "li", { className: "author_header_links" }, [
                            "a", { className: "expanded_arrows_collapsed" }, [
                                "img", { width: "21px"
                                       , height: "20px"
                                       , alt: ""
                                       , src: "/images/spacer.gif"
                                       }, []
                            ]
                        ],
                        "li", { className: "author_header_links"
                              , textContent: " | more " }, [],
                        "li", { className: "author_header_links" }, [
                            "a", { href: "/Account/Profile.aspx?page=Chapters"
                                 }, []
                        ],
                        "li", { className: "author_header_links"
                              , textContent: "  | " }, [],
                        "li", { className: "author_header_links" }, [
                            "a", { href: "/Account/Profile.aspx?act=msg" }, []
                        ]
                    ],
                    "p", {}, [
                        "span", { className: "IBBquotedtable" }, [
                            "b", { textContent: "Posted by: " }, [],
                            "span", { textContent: "Anonymous" }, [],
                            "br", {}, [],
                            "span",  { textContent: "tfw no gf" }, []
                        ]
                    ]
                ]
            ]
        ]
    );

    return e;
}

// mkFloater :: IO DOMObj
function mkFloater(id){
    var wrap = document.createElement("div");
    wrap.className = "coup5floater";
    wrap.style.height = "0px"
    wrap.style.width = "400px";
    wrap.style.margin = "auto";
    if (id != undefined) wrap.id = id;

    var content = document.createElement("div");
    content.style.marginTop = "10%";
    content.style.position = "fixed";
    content.style.zIndex = 9001;
    content.style.backgroundColor = "rgba(0, 0, 0, 0.8)";
    content.style.border = "1px solid";
    content.style.top = 0;
    content.style.padding = "0px";

    var cwrapper = document.createElement("div");
    cwrapper.style.margin = "30px 10px 10px 10px";

    var closer = document.createElement("span");
    closer.style.color = "darkRed";
    closer.style.cursor = "pointer";
    closer.style.cssFloat = "right";
    closer.style.padding = "0px 3px 0px 0px";
    closer.textContent = "X";
    closer.addEventListener("click", function(e){
        var e = this.parentNode.parentNode;
        e.parentNode.removeChild(e);
    });

    content.appendChild(closer);
    content.appendChild(cwrapper);
    wrap.appendChild(content);

    return wrap;
}

// mkPublish :: IO DOMObj
function mkPublish(){
    var form = document.createElement("form");
    SendPost( new GetStyles(false, [ new User(Coup.Username(), 0)  ])
            , function(s){
                maybe(null, function(o){
                    var obj = o.Users[0];
                    maybe(null, function(key){
                        obj = merge(obj, emptyStyles);
                        obj = merge({ Key: key }, obj);
                        obj = merge(obj, { Register: undefined });
                        delete obj.Username;
                    }, Coup.Key());
                    delete obj.Id;
                    Console.Log(JSON.stringify(obj));
                    form.appendChild(mkStyler(obj));
                }, maybeParse(s));
              }
            );

    form.addEventListener("submit", function(e){
        e.preventDefault();
        publishStyles();
    });

    return form;
}

function mkSettings(){
    Console.Log("mkSettings");
}

function mkCache(){
    Console.Log("mkCache");
}

function mkAbout(){
    Console.Log("mkAbout");
}

// mkProfile :: IO ()
function mkProfile(){
    var wrap = document.createElement("div");
    var iboxd = document.createElement("div");
    var boxd = document.createElement("div");
    var header = document.createElement("h3");
    var tabs = document.createElement("div");
    var tablist = { "Publish": mkPublish
                  , "Settings": mkSettings
                  , "Cache": mkCache
                  , "About": mkAbout
                  }
    var ui = document.createElement("div");

    var form = document.createElement("form");

    wrap.id = "Coup5";
    wrap.className = "boxD_outer";
    iboxd.className = "boxD_inner";
    boxd.className = "boxD";
    header.textContent = "Coup d'Bungie 5";
    ui.id = "Coup5UI";
    tabs.style.display = "table";
    tabs.style.width = "100%";

    for (k in tablist){
        var tab = document.createElement("span");

        tab.className = "Coup5Tab";
        tab.textContent = k;

        tab.addEventListener("click", function(){
            var key = this.textContent;
            var coup5ui = document.getElementById("Coup5UI");
            for (var i = 0; i < coup5ui.children.length; i++)
                coup5ui.removeChild(coup5ui.children[i]);
            document.getElementById("Coup5UI").appendChild(tablist[key]());
            for (var i = 0; i < tabs.children.length; i++){
                tabs.children[i].style.backgroundColor = "";
            }
            this.style.backgroundColor = "rgba(255,255,255,0.05)";
        });

        tabs.appendChild(tab);
    }

    // Events

    boxd.appendChild(header);
    boxd.appendChild(tabs);
    boxd.appendChild(ui);
    iboxd.appendChild(boxd);
    wrap.appendChild(iboxd);

    return wrap;
}

// }}}

// insertUI :: IO ()
function insertUI(){
    if (window.location.pathname.match(/\/Account\/Profile\.aspx/i)){
        Console.Log("insertUI: Adding Profile UI.");
        var ui = mkProfile();

        var pid = "ctl00_mainContent_profilePanel";
        var profilePanel = document.getElementById(pid);
        profilePanel.appendChild(ui);
        document.getElementById("Coup5UI").appendChild(mkPublish());
        Console.Log("Successfully added UI.");

    } else if (window.location.pathname.match(/Posts\.aspx/i)) {
        Console.Log("insertUI: Adding Posts UI.");
        Coup.Cache.Autoclear();
        var nameElems = document.getElementsByClassName("login");
        var names = [];
        var cnames = Coup.Cache.Usernames();
        for (var i = 0; i < nameElems.length; i++){
            var name = nameElems[i].textContent;
            if (!elem(name, names) && !elem(name, cnames))
                names.push(name);
        }
        Console.Log("insertUI: " + JSON.stringify(names) + " <|> " +
                    JSON.stringify(cnames)
                   );
        Console.Log("insertUI: Requesting styles " + JSON.stringify(names));
        var obj = makeGetStyles(names);
        SendPost(obj, applyStyles);

        /*for (var i = 0; i < sigs.length; i++){
            var title = sigs[i].parentNode.parentNode.children[0].children[0].children[0].title;
            var text = sigs[i].parentNode.parentNode.children[0].children[0].children[0].textContent;
            var username = title || text;
            var li = document.createElement("li");
            li.innerHTML = "<span>Coup-5-Mod:&nbsp;</span>";
            var a = document.createElement("a");
            a.href = "javascript:;";
            a.className = "coup5modspawn";
            a.textContent = username;
            a.addEventListener("click", spawnMod);
            li.appendChild(a);
            sigs[i].appendChild(li);
        }*/
        if (vs !== ""){
            var pid = window.location.hash.substr(1);
            var es = document.getElementsByName(pid);
            if (es.length > 0){
                var lg = es[0].parentNode.getElementsByClassName("login")[0];
                var urls = lg.children[0].href.split('=');
                var memberId = urls[urls.length - 1];
                var obj = { "Id": parseInt(memberId)
                          , "Time": getPOSIXTime() + 10
                          }
                var sobj = JSON.stringify(obj);
                Browser.Memory.Set("Coup5MemberId", sobj);
            }
        }
        Console.Log("Successfully added UI.");
    } else if ( window.location.pathname.match(/Account\/Settings\.aspx/i)
                && window.location.hash.match("#Coup5Register")){
        Console.Log("insertUI: Adding Settings UI.");
        var rp = document.getElementById(
            "ctl00_mainContent_LoadStatsPageForEmblemLabel"
        );
        var hp = document.getElementById("ctl00_mainContent_bHomepage");
        var vs = Coup.ValidationString();
        var right = new Right("Validation string set...");
        if (rp !== null) Browser.Memory.Set("Coup5ValidationBool"
                                                , JSON.stringify(right)
                                                );
        else if (vs !== ""){
            hp.value = "http://" + vs + ".com/";
            var btn = document.getElementById(
                "ctl00_mainContent_bEditProfileButton2"
            );
            triggerMouseEvent("click", btn);
        } else {
            var left = new Left("Error: no validation string stored.");
            Browser.Memory.Set("Coup5ValidationBool", JSON.stringify(left));
        }
        Console.Log("Successfully added UI.");
    } else if ( window.location.pathname.match(/Search\/default\.aspx/i)
                && window.location.search.match(/\?q=\S+?\&g=5/i)
                && window.location.hash.match("#Coup5Register")){
        Console.Log("insertUI: Adding Search UI.");
        var es = document.getElementsByTagName("strong");
        if (es.length > 0) window.location.href = es[0].children[0].href;
        else Console.Log("SearchRegister: No posts found.");
        Console.Log("Successfully added UI.");
    }
}

// styleUI :: IO ()
function styleUI(){
    var s = document.createElement("style");
    s.type = "text/css";
    s.innerHTML = style;

    document.head.appendChild(s);
}

// }}}

// {{{ Registration

// setValidationString :: String -> IO ()
function setValidationString(){
    var frame = document.createElement("iframe");
    frame.src = "/Account/Settings.aspx#Coup5Register";
    frame.width = 640;
    frame.height = 480;
    frame.style.opacity = 1;
    frame.id = "Coup5ValidationFrame";
    document.getElementById("Coup5UI").appendChild(frame);
}

// getMemberId :: IO ()
function getMemberId(){
    var frame = document.createElement("iframe");
    frame.src = "/Search/default.aspx?q="
                  + Coup.Username() + "&g=5#Coup5Register";
    frame.width = 0;
    frame.height = 0;
    frame.style.opacity = 0;
    frame.id = "Coup5MemberIdFrame";
    document.getElementById("Coup5UI").appendChild(frame);
}

// TODO: less trys and more Maybe.
// storeKey :: String -> IO ()
function storeKey(s){
    var o;
    var msg = document.getElementById("Coup5RegisterHint");
    var keys = document.getElementsByClassName("Key");
    try {
        o = JSON.parse(s);
    } catch(e){
        o = {};
    }
    if (o.Status === 1){
        var sk = Browser.Memory.Get("coup5key"
                                   , "{}"
                                   );
        try {
            var ok = JSON.parse(sk);
            ok[Coup.Username()] = o.Key;
            var sok = JSON.stringify(ok);
            Browser.Memory.Set("coup5key"
                              , sok
                              );
            for (var i = 0; i < keys.length; i++)
                keys[i].getElementsByTagName("input")[0].value = o.Key;
            msg.textContent = [ "Successful"
                              , "registration."
                              ].join(' ');
            msg.style.color = "#66aa11";
        } catch(e){
            Console.Log("storeKey: " + e);
        }
    } else {
        msg.textContent = o.Reason;
        msg.style.color = "#960050";
    }
}

// }}}

// {{{ Publishing
function publishStyles(){
    var msg = document.getElementById("Coup5PublishStatus");
    msg.textContent = "Publishing styles...";
    msg.style.color = "#c47f2c";

    var o = new Publish( Coup.Username("")
                       , fromJust(Coup.Key())
                       , {}
                       , {}
                       , {}
                       , {}
                       );
    var trs = document.getElementById("Coup5UI").getElementsByTagName("tr");
    for (var i = 0; i < trs.length; i++){
        var val;
        var inp = trs[i].children[1].children[0];
        if (inp === undefined) continue;
        var obj = {};
        var keys = trs[i].children[0].textContent.split(' ');
        switch(inp.className){
            case "Show": val = parseBool(getSelectedValue(inp)); break;
            case "Text": val = inp.value; break;
            case "Color":
                val = inp.value ? inp.value : null;
                break;
            case "Opacity": val = parseFloat(inp.value); break;
            case "Image": val = inp.value; break;
            case "GradientLeft":
                val = inp.value ? inp.value : null;
                break;
            case "GradientRight":
                val = inp.value ? inp.value : null;
                break;
            case "Style": val = getSelectedValue(inp); break;
            case "RemoveBars":
                val = parseBool(getSelectedValue(inp));
                break;
            case "ImageRepeat": val = getSelectedValue(inp); break;
            case "ImageAttachment": val = getSelectedValue(inp); break;
            case "ImagePosition": val = inp.value; break;
            case "Font": val = getSelectedValue(inp); break;
            case "BackgroundColor": val = inp.value; break;
            default: val = undefined;
        }
        Console.Log( keys.join(' ') + ": " + (i + 1) +  " of " + trs.length
                     + " with " + val
                   );
        var f = function(ks, ob){
            if (ks.length > 1){
                ob[ks[0]] = f(ks.splice(1), {});
                return ob;
            } else {
                ob[ks[0]] = val;
                return ob;
            }
        }
        if (val !== undefined) o = merge(f(["Data"].concat(keys), obj), o);
    }
    var bgs = [];
    for (k in o.Data.Post.Backgrounds) bgs.push(o.Data.Post.Backgrounds[k]);
    o.Data.Post.Backgrounds = bgs;
    Console.Log("Publish styles: " + JSON.stringify(o));
    SendPost(o, function(str){
        maybe(null, function(obj){
            if (obj.Status === 1){
                delete o.Data.Key;
                Coup.Cache.Add(o.Data);
                msg.textContent = "Publish success!";
                msg.style.color = "#66aa11";
            } else {
                msg.textContent = obj.Reason;
                msg.style.color = "#960050";
            }
        }, maybeParse(str));
    });
}
// }}}

// main :: IO ()
function main(){
    if (Browser.SupportsCoupDBungie()){
        insertUI();
        styleUI();
    } else {
        var reason = "Your browser does not support Coup-5-Mod.";
        reason += "\nlocalStorage: " + (localStorage ? true : false);
        reason += "\nXMLHttpRequest: " + (XMLHttpRequest ? true : false);
        reason += "\nJSON: " + (JSON ? true : false);
        alert(reason);
    }
}

main();
