// ==UserScript==
// @name      ttf deltek ver 2.2 real gg lel heh
// @author       ttf  ass
// @description  secret
// @version      2.2
// @match        *://*.moomoo.io/*
// @match        http://localhost:8080/
// @grant        none
// ==/UserScript==

/*
Teaching deltas

// == and =
= is used when u give a value to a variable (count = true or count = 0) = means literally "is"
== is used when u confront 2 values in a condition (1 == 2 or count == 2 or count == count2) == means literally "is?"

// Some syntax stuff

// Accumulation
sum += num means sum = sum + num  // Lets say u need to sum a number to a variable

let sum = 0;
for(let i = 0; i < objects.length; i++)
{
    sum += i;
}





// Declaration of variables
You should just always use let
Rules
1) If you declare variable inside a {} you can only use it there
2) the name of the variable can't have spaces you're limited to just using _
3) names should actually mean what variables do
4) you can't have 2 variables of the same name in the same environment

// Conditions
1) Conditions are inside an if or inside a filter/find of an array
2) If inside an if this is the structure:
if(conditions) // If the conditons are true doStuff happens
{
    doStuff
}
else or u can use else if() // For a chain but using else is not necessary unless u need it
3) If a filter/find of an array
"arrayName".filter(object => conditions)
// The array has data, what this does is this loops thru all data in the array,
and every single time it loops, each data that its looping is equal to object so if its looping a spike, object = that spike
// Game example

poisonSpikes = AllVisibleSpikes.filter(spike => spike.id == 7);  // this filters all spikes that have an id of 7

-how this works is we have the AllVisibleSpikes array that has certain type of data and the spike variable declared inside the ()
will have the same data type of each data in AllVisibleSpikes
filtering is choosing certain data that meets our conditions
it basically works like this
for(let spike of AllVisibleSpikes)
{
    if(spike.id == 7)
    {
        poisonSpikes.push(spike); // poisonSpikes is antoher array the .push basically takes the element inside the brackets and "pushes" it to the array
    }
}

// Arrays
Arrays are a mix of more variables for example
let objects = [1, 3, "hi"]; how do i find the 1?
by position in the array. objects[0] = 1 objects[1] = 3, objects[2] = "hi"
objects is an array containing n of objects
this n is defined by objects.length // length is a property of an array and every array has this propriety
its an important property because you will need to use it to check if the array exists (objects.length > 0)

Examples:

//Array
visibleSpikes = [spike1, spike2, spike3, spike4, spike5]   //visibleSpikes.length is 5


// Loops
for(let object of objects)
{
    // loops thru all objects of the objects array
    "object" is the object that we're currently checking

    if(object.id == 6)
    {
        console.log("object is a spike")
    }
}

for(let i = 0; i < objects.length; i++) // Same thing as above
i is the looper, the variable that counts at what point in the loop we are
each time it gets incremented by i++ // i++ is the same thing as i = i + 1; so if i was 1 i is now 2;
the condtion is i < objects.length so this loop runs for how many elements the array has

for(let i = 0; i < objects.length; i++)
{
    if(objects[i].id == 6)
    {
        console.log("object is a spike")
    }
}









*/
























let wsAddress;
let pathBreak = false;
let grindObjects = [];
let prevKills = 0;
let path = null;
let autoaimAngle = null;
let autogathering = false;
let currentHat = 0;
let imTrapped = false;
let shouldResetShame = false;
let totalDmgPot = 0;
let lastcolliding = false;
let spikeTickAnti = false;
let grindAngle = null;
let smartTickObject = null;
let iWasTrapped = false;
let lastPredicted = false;
let gatherGrind = false;
let lastPosX = 0;
let lastPosY = 0;
let canStillGather = false;
let autoBreakWeapon = null;
let spikes_our = [];
let traps_our = [];
let enemy_lastcollidngspike = false;
let enemy_collidingspike = false;
let placedAngles = [];
let bannedAngles = new Map();
let smartTickSpike = null;
let gPressed = false;
let turrets_our = null;
let pathPosition = null;
let pathMode = {
    avoidEnemySpikes: false,
    avoidEnemy: false,
}
let filteredObjectsCache = {
    tick: -1,
    withSpikes: null,
    withoutSpikes: null,
};
let xOffset = null;
let yOffset = null;
let shouldntPathfind = false;








let settings = {
    botplatformplacer: false,
    botcount: 40,
    botname: "Helper",
    gamezoom: 100,
    x18ksync: true,
    chatlog: false,
    spampreplace: true,
    autoPlace: true,
};

const autoBuyList = [
    { id: 15, type: 0, cost: 600 },    // winter
    { id: 11, type: 1, cost: 2000 },   // monkey_tail
    { id: 31, type: 0, cost: 2500 },   // flipper
    { id: 6, type: 0, cost: 4000 },   // soldier
    { id: 40, type: 0, cost: 15000 },  // tank
    { id: 7, type: 0, cost: 6000 },   // bull
    { id: 12, type: 0, cost: 6000 },   // booster
    { id: 53, type: 0, cost: 10000 },  // turret
    { id: 19, type: 1, cost: 15000 }   // shadow_wings
];



window.packets = 0;
window.packetInterval = null;
window.pps = 0;



/******/ (function (modules) { // webpackBootstrap
    /******/ 	// The module cache
    /******/ 	var installedModules = {};
    /******/
    /******/ 	// The require function
    /******/ 	function __webpack_require__(moduleId) {
        /******/
        /******/ 		// Check if module is in cache
        /******/ 		if (installedModules[moduleId]) {
            /******/ 			return installedModules[moduleId].exports;
            /******/
        }
        /******/ 		// Create a new module (and put it into the cache)
        /******/ 		var module = installedModules[moduleId] = {
            /******/ 			i: moduleId,
            /******/ 			l: false,
            /******/ 			exports: {}
            /******/
        };
        /******/
        /******/ 		// Execute the module function
        /******/ 		modules[moduleId].call(module.exports, module, module.exports, __webpack_require__);
        /******/
        /******/ 		// Flag the module as loaded
        /******/ 		module.l = true;
        /******/
        /******/ 		// Return the exports of the module
        /******/ 		return module.exports;
        /******/
    }
    /******/
    /******/
    /******/ 	// expose the modules object (__webpack_modules__)
    /******/ 	__webpack_require__.m = modules;
    /******/
    /******/ 	// expose the module cache
    /******/ 	__webpack_require__.c = installedModules;
    /******/
    /******/ 	// define getter function for harmony exports
    /******/ 	__webpack_require__.d = function (exports, name, getter) {
        /******/ 		if (!__webpack_require__.o(exports, name)) {
            /******/ 			Object.defineProperty(exports, name, { enumerable: true, get: getter });
            /******/
        }
        /******/
    };
    /******/
    /******/ 	// define __esModule on exports
    /******/ 	__webpack_require__.r = function (exports) {
        /******/ 		if (typeof Symbol !== 'undefined' && Symbol.toStringTag) {
            /******/ 			Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
            /******/
        }
        /******/ 		Object.defineProperty(exports, '__esModule', { value: true });
        /******/
    };
    /******/
    /******/ 	// create a fake namespace object
    /******/ 	// mode & 1: value is a module id, require it
    /******/ 	// mode & 2: merge all properties of value into the ns
    /******/ 	// mode & 4: return value when already ns object
    /******/ 	// mode & 8|1: behave like require
    /******/ 	__webpack_require__.t = function (value, mode) {
        /******/ 		if (mode & 1) value = __webpack_require__(value);
        /******/ 		if (mode & 8) return value;
        /******/ 		if ((mode & 4) && typeof value === 'object' && value && value.__esModule) return value;
        /******/ 		var ns = Object.create(null);
        /******/ 		__webpack_require__.r(ns);
        /******/ 		Object.defineProperty(ns, 'default', { enumerable: true, value: value });
        /******/ 		if (mode & 2 && typeof value != 'string') for (var key in value) __webpack_require__.d(ns, key, function (key) { return value[key]; }.bind(null, key));
        /******/ 		return ns;
        /******/
    };
    /******/
    /******/ 	// getDefaultExport function for compatibility with non-harmony modules
    /******/ 	__webpack_require__.n = function (module) {
        /******/ 		var getter = module && module.__esModule ?
            /******/ 			function getDefault() { return module['default']; } :
        /******/ 			function getModuleExports() { return module; };
        /******/ 		__webpack_require__.d(getter, 'a', getter);
        /******/ 		return getter;
        /******/
    };
    /******/
    /******/ 	// Object.prototype.hasOwnProperty.call
    /******/ 	__webpack_require__.o = function (object, property) { return Object.prototype.hasOwnProperty.call(object, property); };
    /******/
    /******/ 	// __webpack_public_path__
    /******/ 	__webpack_require__.p = "";
    /******/
    /******/
    /******/ 	// Load entry module and return exports
    /******/ 	return __webpack_require__(__webpack_require__.s = "./src/js/app.js");
    /******/
})
/************************************************************************/
/******/({

    /***/ "./node_modules/bad-words/lib/badwords.js":
    /*!************************************************!*\
  !*** ./node_modules/bad-words/lib/badwords.js ***!
  \************************************************/
    /*! no static exports found */
    /***/ (function (module, exports, __webpack_require__) {

        const localList = __webpack_require__(/*! ./lang.json */ "./node_modules/bad-words/lib/lang.json").words;
        const baseList = __webpack_require__(/*! badwords-list */ "./node_modules/badwords-list/lib/index.js").array;

        class Filter {

            /**
       * Filter constructor.
       * @constructor
       * @param {object} options - Filter instance options
       * @param {boolean} options.emptyList - Instantiate filter with no blacklist
       * @param {array} options.list - Instantiate filter with custom list
       * @param {string} options.placeHolder - Character used to replace profane words.
       * @param {string} options.regex - Regular expression used to sanitize words before comparing them to blacklist.
       * @param {string} options.replaceRegex - Regular expression used to replace profane words with placeHolder.
       */
            constructor(options = {}) {
                Object.assign(this, {
                    list: options.emptyList && [] || Array.prototype.concat.apply(localList, [baseList, options.list || []]),
                    exclude: options.exclude || [],
                    placeHolder: options.placeHolder || '*',
                    regex: options.regex || /[^a-zA-Z0-9|\$|\@]|\^/g,
                    replaceRegex: options.replaceRegex || /\w/g
                })
            }

            /**
       * Determine if a string contains profane language.
       * @param {string} string - String to evaluate for profanity.
       */
            isProfane(string) {
                return this.list
                    .filter((word) => {
                    const wordExp = new RegExp(`\\b${word.replace(/(\W)/g, '\\$1')}\\b`, 'gi');
                    return !this.exclude.includes(word.toLowerCase()) && wordExp.test(string);
                })
                    .length > 0 || false;
            }

            /**
       * Replace a word with placeHolder characters;
       * @param {string} string - String to replace.
       */
            replaceWord(string) {
                return string
                    .replace(this.regex, '')
                    .replace(this.replaceRegex, this.placeHolder);
            }

            /**
       * Evaluate a string for profanity and return an edited version.
       * @param {string} string - Sentence to filter.
       */
            clean(string) {
                return string.split(/\b/).map((word) => {
                    return this.isProfane(word) ? this.replaceWord(word) : word;
                }).join('');
            }

            /**
       * Add word(s) to blacklist filter / remove words from whitelist filter
       * @param {...string} word - Word(s) to add to blacklist
       */
            addWords() {
                let words = Array.from(arguments);

                this.list.push(...words);

                words
                    .map(word => word.toLowerCase())
                    .forEach((word) => {
                    if (this.exclude.includes(word)) {
                        this.exclude.splice(this.exclude.indexOf(word), 1);
                    }
                });
            }

            /**
       * Add words to whitelist filter
       * @param {...string} word - Word(s) to add to whitelist.
       */
            removeWords() {
                this.exclude.push(...Array.from(arguments).map(word => word.toLowerCase()));
            }
        }

        module.exports = Filter;

        /***/
    }),

    /***/ "./node_modules/bad-words/lib/lang.json":
    /*!**********************************************!*\
  !*** ./node_modules/bad-words/lib/lang.json ***!
  \**********************************************/
    /*! exports provided: words, default */
    /***/ (function (module) {

        module.exports = { "words": ["ahole", "anus", "ash0le", "ash0les", "asholes", "ass", "Ass Monkey", "Assface", "assh0le", "assh0lez", "asshole", "assholes", "assholz", "asswipe", "azzhole", "bassterds", "bastard", "bastards", "bastardz", "basterds", "basterdz", "Biatch", "bitch", "bitches", "Blow Job", "boffing", "butthole", "buttwipe", "c0ck", "c0cks", "c0k", "Carpet Muncher", "cawk", "cawks", "Clit", "cnts", "cntz", "cock", "cockhead", "cock-head", "cocks", "CockSucker", "cock-sucker", "crap", "cum", "cunt", "cunts", "cuntz", "dick", "dild0", "dild0s", "dildo", "dildos", "dilld0", "dilld0s", "dominatricks", "dominatrics", "dominatrix", "dyke", "enema", "f u c k", "f u c k e r", "fag", "fag1t", "faget", "fagg1t", "faggit", "faggot", "fagg0t", "fagit", "fags", "fagz", "faig", "faigs", "fart", "flipping the bird", "fuck", "fucker", "fuckin", "fucking", "fucks", "Fudge Packer", "fuk", "Fukah", "Fuken", "fuker", "Fukin", "Fukk", "Fukkah", "Fukken", "Fukker", "Fukkin", "g00k", "God-damned", "h00r", "h0ar", "h0re", "hells", "hoar", "hoor", "hoore", "jackoff", "jap", "japs", "jerk-off", "jisim", "jiss", "jizm", "jizz", "knob", "knobs", "knobz", "kunt", "kunts", "kuntz", "Lezzian", "Lipshits", "Lipshitz", "masochist", "masokist", "massterbait", "masstrbait", "masstrbate", "masterbaiter", "masterbate", "masterbates", "Motha Fucker", "Motha Fuker", "Motha Fukkah", "Motha Fukker", "Mother Fucker", "Mother Fukah", "Mother Fuker", "Mother Fukkah", "Mother Fukker", "mother-fucker", "Mutha Fucker", "Mutha Fukah", "Mutha Fuker", "Mutha Fukkah", "Mutha Fukker", "n1gr", "nastt", "nigger;", "nigur;", "niiger;", "niigr;", "orafis", "orgasim;", "orgasm", "orgasum", "oriface", "orifice", "orifiss", "packi", "packie", "packy", "paki", "pakie", "paky", "pecker", "peeenus", "peeenusss", "peenus", "peinus", "pen1s", "penas", "penis", "penis-breath", "penus", "penuus", "Phuc", "Phuck", "Phuk", "Phuker", "Phukker", "polac", "polack", "polak", "Poonani", "pr1c", "pr1ck", "pr1k", "pusse", "pussee", "pussy", "puuke", "puuker", "queer", "queers", "queerz", "qweers", "qweerz", "qweir", "recktum", "rectum", "retard", "sadist", "scank", "schlong", "screwing", "semen", "sex", "sexy", "Sh!t", "sh1t", "sh1ter", "sh1ts", "sh1tter", "sh1tz", "shit", "shits", "shitter", "Shitty", "Shity", "shitz", "Shyt", "Shyte", "Shytty", "Shyty", "skanck", "skank", "skankee", "skankey", "skanks", "Skanky", "slag", "slut", "sluts", "Slutty", "slutz", "son-of-a-bitch", "tit", "turd", "va1jina", "vag1na", "vagiina", "vagina", "vaj1na", "vajina", "vullva", "vulva", "w0p", "wh00r", "wh0re", "whore", "xrated", "xxx", "b!+ch", "bitch", "blowjob", "clit", "arschloch", "fuck", "shit", "ass", "asshole", "b!tch", "b17ch", "b1tch", "bastard", "bi+ch", "boiolas", "buceta", "c0ck", "cawk", "chink", "cipa", "clits", "cock", "cum", "cunt", "dildo", "dirsa", "ejakulate", "fatass", "fcuk", "fuk", "fux0r", "hoer", "hore", "jism", "kawk", "l3itch", "l3i+ch", "lesbian", "masturbate", "masterbat*", "masterbat3", "motherfucker", "s.o.b.", "mofo", "nazi", "nigga", "nigger", "nutsack", "phuck", "pimpis", "pusse", "pussy", "scrotum", "sh!t", "shemale", "shi+", "sh!+", "slut", "smut", "teets", "tits", "boobs", "b00bs", "teez", "testical", "testicle", "titt", "w00se", "jackoff", "wank", "whoar", "whore", "*damn", "*dyke", "*fuck*", "*shit*", "@$$", "amcik", "andskota", "arse*", "assrammer", "ayir", "bi7ch", "bitch*", "bollock*", "breasts", "butt-pirate", "cabron", "cazzo", "chraa", "chuj", "Cock*", "cunt*", "d4mn", "daygo", "dego", "dick*", "dike*", "dupa", "dziwka", "ejackulate", "Ekrem*", "Ekto", "enculer", "faen", "fag*", "fanculo", "fanny", "feces", "feg", "Felcher", "ficken", "fitt*", "Flikker", "foreskin", "Fotze", "Fu(*", "fuk*", "futkretzn", "gook", "guiena", "h0r", "h4x0r", "hell", "helvete", "hoer*", "honkey", "Huevon", "hui", "injun", "jizz", "kanker*", "kike", "klootzak", "kraut", "knulle", "kuk", "kuksuger", "Kurac", "kurwa", "kusi*", "kyrpa*", "lesbo", "mamhoon", "masturbat*", "merd*", "mibun", "monkleigh", "mouliewop", "muie", "mulkku", "muschi", "nazis", "nepesaurio", "nigger*", "orospu", "paska*", "perse", "picka", "pierdol*", "pillu*", "pimmel", "piss*", "pizda", "poontsee", "poop", "porn", "p0rn", "pr0n", "preteen", "pula", "pule", "puta", "puto", "qahbeh", "queef*", "rautenberg", "schaffer", "scheiss*", "schlampe", "schmuck", "screw", "sh!t*", "sharmuta", "sharmute", "shipal", "shiz", "skribz", "skurwysyn", "sphencter", "spic", "spierdalaj", "splooge", "suka", "b00b*", "testicle*", "titt*", "twat", "vittu", "wank*", "wetback*", "wichser", "wop*", "yed", "zabourah"] };

        /***/
    }),

    /***/ "./node_modules/badwords-list/lib/array.js":
    /*!*************************************************!*\
  !*** ./node_modules/badwords-list/lib/array.js ***!
  \*************************************************/
    /*! no static exports found */
    /***/ (function (module, exports) {

        module.exports = ["4r5e", "5h1t", "5hit", "a55", "anal", "anus", "ar5e", "arrse", "arse", "ass", "ass-fucker", "asses", "assfucker", "assfukka", "asshole", "assholes", "asswhole", "a_s_s", "b!tch", "b00bs", "b17ch", "b1tch", "ballbag", "balls", "ballsack", "bastard", "beastial", "beastiality", "bellend", "bestial", "bestiality", "bi+ch", "biatch", "bitch", "bitcher", "bitchers", "bitches", "bitchin", "bitching", "bloody", "blow job", "blowjob", "blowjobs", "boiolas", "bollock", "bollok", "boner", "boob", "boobs", "booobs", "boooobs", "booooobs", "booooooobs", "breasts", "buceta", "bugger", "bum", "bunny fucker", "butt", "butthole", "buttmuch", "buttplug", "c0ck", "c0cksucker", "carpet muncher", "cawk", "chink", "cipa", "cl1t", "clit", "clitoris", "clits", "cnut", "cock", "cock-sucker", "cockface", "cockhead", "cockmunch", "cockmuncher", "cocks", "cocksuck", "cocksucked", "cocksucker", "cocksucking", "cocksucks", "cocksuka", "cocksukka", "cok", "cokmuncher", "coksucka", "coon", "cox", "crap", "cum", "cummer", "cumming", "cums", "cumshot", "cunilingus", "cunillingus", "cunnilingus", "cunt", "cuntlick", "cuntlicker", "cuntlicking", "cunts", "cyalis", "cyberfuc", "cyberfuck", "cyberfucked", "cyberfucker", "cyberfuckers", "cyberfucking", "d1ck", "damn", "dick", "dickhead", "dildo", "dildos", "dink", "dinks", "dirsa", "dlck", "dog-fucker", "doggin", "dogging", "donkeyribber", "doosh", "duche", "dyke", "ejaculate", "ejaculated", "ejaculates", "ejaculating", "ejaculatings", "ejaculation", "ejakulate", "f u c k", "f u c k e r", "f4nny", "fag", "fagging", "faggitt", "faggot", "faggs", "fagot", "fagots", "fags", "fanny", "fannyflaps", "fannyfucker", "fanyy", "fatass", "fcuk", "fcuker", "fcuking", "feck", "fecker", "felching", "fellate", "fellatio", "fingerfuck", "fingerfucked", "fingerfucker", "fingerfuckers", "fingerfucking", "fingerfucks", "fistfuck", "fistfucked", "fistfucker", "fistfuckers", "fistfucking", "fistfuckings", "fistfucks", "flange", "fook", "fooker", "fuck", "fucka", "fucked", "fucker", "fuckers", "fuckhead", "fuckheads", "fuckin", "fucking", "fuckings", "fuckingshitmotherfucker", "fuckme", "fucks", "fuckwhit", "fuckwit", "fudge packer", "fudgepacker", "fuk", "fuker", "fukker", "fukkin", "fuks", "fukwhit", "fukwit", "fux", "fux0r", "f_u_c_k", "gangbang", "gangbanged", "gangbangs", "gaylord", "gaysex", "goatse", "God", "god-dam", "god-damned", "goddamn", "goddamned", "hardcoresex", "hell", "heshe", "hoar", "hoare", "hoer", "homo", "hore", "horniest", "horny", "hotsex", "jack-off", "jackoff", "jap", "jerk-off", "jism", "jiz", "jizm", "jizz", "kawk", "knob", "knobead", "knobed", "knobend", "knobhead", "knobjocky", "knobjokey", "kock", "kondum", "kondums", "kum", "kummer", "kumming", "kums", "kunilingus", "l3i+ch", "l3itch", "labia", "lust", "lusting", "m0f0", "m0fo", "m45terbate", "ma5terb8", "ma5terbate", "masochist", "master-bate", "masterb8", "masterbat*", "masterbat3", "masterbate", "masterbation", "masterbations", "masturbate", "mo-fo", "mof0", "mofo", "mothafuck", "mothafucka", "mothafuckas", "mothafuckaz", "mothafucked", "mothafucker", "mothafuckers", "mothafuckin", "mothafucking", "mothafuckings", "mothafucks", "mother fucker", "motherfuck", "motherfucked", "motherfucker", "motherfuckers", "motherfuckin", "motherfucking", "motherfuckings", "motherfuckka", "motherfucks", "muff", "mutha", "muthafecker", "muthafuckker", "muther", "mutherfucker", "n1gga", "n1gger", "nazi", "nigg3r", "nigg4h", "nigga", "niggah", "niggas", "niggaz", "nigger", "niggers", "nob", "nob jokey", "nobhead", "nobjocky", "nobjokey", "numbnuts", "nutsack", "orgasim", "orgasims", "orgasm", "orgasms", "p0rn", "pawn", "pecker", "penis", "penisfucker", "phonesex", "phuck", "phuk", "phuked", "phuking", "phukked", "phukking", "phuks", "phuq", "pigfucker", "pimpis", "piss", "pissed", "pisser", "pissers", "pisses", "pissflaps", "pissin", "pissing", "pissoff", "poop", "porn", "porno", "pornography", "pornos", "prick", "pricks", "pron", "pube", "pusse", "pussi", "pussies", "pussy", "pussys", "rectum", "retard", "rimjaw", "rimming", "s hit", "s.o.b.", "sadist", "schlong", "screwing", "scroat", "scrote", "scrotum", "semen", "sex", "sh!+", "sh!t", "sh1t", "shag", "shagger", "shaggin", "shagging", "shemale", "shi+", "shit", "shitdick", "shite", "shited", "shitey", "shitfuck", "shitfull", "shithead", "shiting", "shitings", "shits", "shitted", "shitter", "shitters", "shitting", "shittings", "shitty", "skank", "slut", "sluts", "smegma", "smut", "snatch", "son-of-a-bitch", "spac", "spunk", "s_h_i_t", "t1tt1e5", "t1tties", "teets", "teez", "testical", "testicle", "tit", "titfuck", "tits", "titt", "tittie5", "tittiefucker", "titties", "tittyfuck", "tittywank", "titwank", "tosser", "turd", "tw4t", "twat", "twathead", "twatty", "twunt", "twunter", "v14gra", "v1gra", "vagina", "viagra", "vulva", "w00se", "wang", "wank", "wanker", "wanky", "whoar", "whore", "willies", "willy", "xrated", "xxx"];

        /***/
    }),

    /***/ "./node_modules/badwords-list/lib/index.js":
    /*!*************************************************!*\
  !*** ./node_modules/badwords-list/lib/index.js ***!
  \*************************************************/
    /*! no static exports found */
    /***/ (function (module, exports, __webpack_require__) {

        module.exports = {
            object: __webpack_require__(/*! ./object */ "./node_modules/badwords-list/lib/object.js"),
            array: __webpack_require__(/*! ./array */ "./node_modules/badwords-list/lib/array.js"),
            regex: __webpack_require__(/*! ./regexp */ "./node_modules/badwords-list/lib/regexp.js")
        };

        /***/
    }),

    /***/ "./node_modules/badwords-list/lib/object.js":
    /*!**************************************************!*\
  !*** ./node_modules/badwords-list/lib/object.js ***!
  \**************************************************/
    /*! no static exports found */
    /***/ (function (module, exports) {

        module.exports = { "4r5e": 1, "5h1t": 1, "5hit": 1, "a55": 1, "anal": 1, "anus": 1, "ar5e": 1, "arrse": 1, "arse": 1, "ass": 1, "ass-fucker": 1, "asses": 1, "assfucker": 1, "assfukka": 1, "asshole": 1, "assholes": 1, "asswhole": 1, "a_s_s": 1, "b!tch": 1, "b00bs": 1, "b17ch": 1, "b1tch": 1, "ballbag": 1, "balls": 1, "ballsack": 1, "bastard": 1, "beastial": 1, "beastiality": 1, "bellend": 1, "bestial": 1, "bestiality": 1, "bi+ch": 1, "biatch": 1, "bitch": 1, "bitcher": 1, "bitchers": 1, "bitches": 1, "bitchin": 1, "bitching": 1, "bloody": 1, "blow job": 1, "blowjob": 1, "blowjobs": 1, "boiolas": 1, "bollock": 1, "bollok": 1, "boner": 1, "boob": 1, "boobs": 1, "booobs": 1, "boooobs": 1, "booooobs": 1, "booooooobs": 1, "breasts": 1, "buceta": 1, "bugger": 1, "bum": 1, "bunny fucker": 1, "butt": 1, "butthole": 1, "buttmuch": 1, "buttplug": 1, "c0ck": 1, "c0cksucker": 1, "carpet muncher": 1, "cawk": 1, "chink": 1, "cipa": 1, "cl1t": 1, "clit": 1, "clitoris": 1, "clits": 1, "cnut": 1, "cock": 1, "cock-sucker": 1, "cockface": 1, "cockhead": 1, "cockmunch": 1, "cockmuncher": 1, "cocks": 1, "cocksuck": 1, "cocksucked": 1, "cocksucker": 1, "cocksucking": 1, "cocksucks": 1, "cocksuka": 1, "cocksukka": 1, "cok": 1, "cokmuncher": 1, "coksucka": 1, "coon": 1, "cox": 1, "crap": 1, "cum": 1, "cummer": 1, "cumming": 1, "cums": 1, "cumshot": 1, "cunilingus": 1, "cunillingus": 1, "cunnilingus": 1, "cunt": 1, "cuntlick": 1, "cuntlicker": 1, "cuntlicking": 1, "cunts": 1, "cyalis": 1, "cyberfuc": 1, "cyberfuck": 1, "cyberfucked": 1, "cyberfucker": 1, "cyberfuckers": 1, "cyberfucking": 1, "d1ck": 1, "damn": 1, "dick": 1, "dickhead": 1, "dildo": 1, "dildos": 1, "dink": 1, "dinks": 1, "dirsa": 1, "dlck": 1, "dog-fucker": 1, "doggin": 1, "dogging": 1, "donkeyribber": 1, "doosh": 1, "duche": 1, "dyke": 1, "ejaculate": 1, "ejaculated": 1, "ejaculates": 1, "ejaculating": 1, "ejaculatings": 1, "ejaculation": 1, "ejakulate": 1, "f u c k": 1, "f u c k e r": 1, "f4nny": 1, "fag": 1, "fagging": 1, "faggitt": 1, "faggot": 1, "faggs": 1, "fagot": 1, "fagots": 1, "fags": 1, "fanny": 1, "fannyflaps": 1, "fannyfucker": 1, "fanyy": 1, "fatass": 1, "fcuk": 1, "fcuker": 1, "fcuking": 1, "feck": 1, "fecker": 1, "felching": 1, "fellate": 1, "fellatio": 1, "fingerfuck": 1, "fingerfucked": 1, "fingerfucker": 1, "fingerfuckers": 1, "fingerfucking": 1, "fingerfucks": 1, "fistfuck": 1, "fistfucked": 1, "fistfucker": 1, "fistfuckers": 1, "fistfucking": 1, "fistfuckings": 1, "fistfucks": 1, "flange": 1, "fook": 1, "fooker": 1, "fuck": 1, "fucka": 1, "fucked": 1, "fucker": 1, "fuckers": 1, "fuckhead": 1, "fuckheads": 1, "fuckin": 1, "fucking": 1, "fuckings": 1, "fuckingshitmotherfucker": 1, "fuckme": 1, "fucks": 1, "fuckwhit": 1, "fuckwit": 1, "fudge packer": 1, "fudgepacker": 1, "fuk": 1, "fuker": 1, "fukker": 1, "fukkin": 1, "fuks": 1, "fukwhit": 1, "fukwit": 1, "fux": 1, "fux0r": 1, "f_u_c_k": 1, "gangbang": 1, "gangbanged": 1, "gangbangs": 1, "gaylord": 1, "gaysex": 1, "goatse": 1, "God": 1, "god-dam": 1, "god-damned": 1, "goddamn": 1, "goddamned": 1, "hardcoresex": 1, "hell": 1, "heshe": 1, "hoar": 1, "hoare": 1, "hoer": 1, "homo": 1, "hore": 1, "horniest": 1, "horny": 1, "hotsex": 1, "jack-off": 1, "jackoff": 1, "jap": 1, "jerk-off": 1, "jism": 1, "jiz": 1, "jizm": 1, "jizz": 1, "kawk": 1, "knob": 1, "knobead": 1, "knobed": 1, "knobend": 1, "knobhead": 1, "knobjocky": 1, "knobjokey": 1, "kock": 1, "kondum": 1, "kondums": 1, "kum": 1, "kummer": 1, "kumming": 1, "kums": 1, "kunilingus": 1, "l3i+ch": 1, "l3itch": 1, "labia": 1, "lust": 1, "lusting": 1, "m0f0": 1, "m0fo": 1, "m45terbate": 1, "ma5terb8": 1, "ma5terbate": 1, "masochist": 1, "master-bate": 1, "masterb8": 1, "masterbat*": 1, "masterbat3": 1, "masterbate": 1, "masterbation": 1, "masterbations": 1, "masturbate": 1, "mo-fo": 1, "mof0": 1, "mofo": 1, "mothafuck": 1, "mothafucka": 1, "mothafuckas": 1, "mothafuckaz": 1, "mothafucked": 1, "mothafucker": 1, "mothafuckers": 1, "mothafuckin": 1, "mothafucking": 1, "mothafuckings": 1, "mothafucks": 1, "mother fucker": 1, "motherfuck": 1, "motherfucked": 1, "motherfucker": 1, "motherfuckers": 1, "motherfuckin": 1, "motherfucking": 1, "motherfuckings": 1, "motherfuckka": 1, "motherfucks": 1, "muff": 1, "mutha": 1, "muthafecker": 1, "muthafuckker": 1, "muther": 1, "mutherfucker": 1, "n1gga": 1, "n1gger": 1, "nazi": 1, "nigg3r": 1, "nigg4h": 1, "nigga": 1, "niggah": 1, "niggas": 1, "niggaz": 1, "nigger": 1, "niggers": 1, "nob": 1, "nob jokey": 1, "nobhead": 1, "nobjocky": 1, "nobjokey": 1, "numbnuts": 1, "nutsack": 1, "orgasim": 1, "orgasims": 1, "orgasm": 1, "orgasms": 1, "p0rn": 1, "pawn": 1, "pecker": 1, "penis": 1, "penisfucker": 1, "phonesex": 1, "phuck": 1, "phuk": 1, "phuked": 1, "phuking": 1, "phukked": 1, "phukking": 1, "phuks": 1, "phuq": 1, "pigfucker": 1, "pimpis": 1, "piss": 1, "pissed": 1, "pisser": 1, "pissers": 1, "pisses": 1, "pissflaps": 1, "pissin": 1, "pissing": 1, "pissoff": 1, "poop": 1, "porn": 1, "porno": 1, "pornography": 1, "pornos": 1, "prick": 1, "pricks": 1, "pron": 1, "pube": 1, "pusse": 1, "pussi": 1, "pussies": 1, "pussy": 1, "pussys": 1, "rectum": 1, "retard": 1, "rimjaw": 1, "rimming": 1, "s hit": 1, "s.o.b.": 1, "sadist": 1, "schlong": 1, "screwing": 1, "scroat": 1, "scrote": 1, "scrotum": 1, "semen": 1, "sex": 1, "sh!+": 1, "sh!t": 1, "sh1t": 1, "shag": 1, "shagger": 1, "shaggin": 1, "shagging": 1, "shemale": 1, "shi+": 1, "shit": 1, "shitdick": 1, "shite": 1, "shited": 1, "shitey": 1, "shitfuck": 1, "shitfull": 1, "shithead": 1, "shiting": 1, "shitings": 1, "shits": 1, "shitted": 1, "shitter": 1, "shitters": 1, "shitting": 1, "shittings": 1, "shitty": 1, "skank": 1, "slut": 1, "sluts": 1, "smegma": 1, "smut": 1, "snatch": 1, "son-of-a-bitch": 1, "spac": 1, "spunk": 1, "s_h_i_t": 1, "t1tt1e5": 1, "t1tties": 1, "teets": 1, "teez": 1, "testical": 1, "testicle": 1, "tit": 1, "titfuck": 1, "tits": 1, "titt": 1, "tittie5": 1, "tittiefucker": 1, "titties": 1, "tittyfuck": 1, "tittywank": 1, "titwank": 1, "tosser": 1, "turd": 1, "tw4t": 1, "twat": 1, "twathead": 1, "twatty": 1, "twunt": 1, "twunter": 1, "v14gra": 1, "v1gra": 1, "vagina": 1, "viagra": 1, "vulva": 1, "w00se": 1, "wang": 1, "wank": 1, "wanker": 1, "wanky": 1, "whoar": 1, "whore": 1, "willies": 1, "willy": 1, "xrated": 1, "xxx": 1 };

        /***/
    }),

    /***/ "./node_modules/badwords-list/lib/regexp.js":
    /*!**************************************************!*\
  !*** ./node_modules/badwords-list/lib/regexp.js ***!
  \**************************************************/
    /*! no static exports found */
    /***/ (function (module, exports) {

        module.exports = /\b(4r5e|5h1t|5hit|a55|anal|anus|ar5e|arrse|arse|ass|ass-fucker|asses|assfucker|assfukka|asshole|assholes|asswhole|a_s_s|b!tch|b00bs|b17ch|b1tch|ballbag|balls|ballsack|bastard|beastial|beastiality|bellend|bestial|bestiality|bi\+ch|biatch|bitch|bitcher|bitchers|bitches|bitchin|bitching|bloody|blow job|blowjob|blowjobs|boiolas|bollock|bollok|boner|boob|boobs|booobs|boooobs|booooobs|booooooobs|breasts|buceta|bugger|bum|bunny fucker|butt|butthole|buttmuch|buttplug|c0ck|c0cksucker|carpet muncher|cawk|chink|cipa|cl1t|clit|clitoris|clits|cnut|cock|cock-sucker|cockface|cockhead|cockmunch|cockmuncher|cocks|cocksuck|cocksucked|cocksucker|cocksucking|cocksucks|cocksuka|cocksukka|cok|cokmuncher|coksucka|coon|cox|crap|cum|cummer|cumming|cums|cumshot|cunilingus|cunillingus|cunnilingus|cunt|cuntlick|cuntlicker|cuntlicking|cunts|cyalis|cyberfuc|cyberfuck|cyberfucked|cyberfucker|cyberfuckers|cyberfucking|d1ck|damn|dick|dickhead|dildo|dildos|dink|dinks|dirsa|dlck|dog-fucker|doggin|dogging|donkeyribber|doosh|duche|dyke|ejaculate|ejaculated|ejaculates|ejaculating|ejaculatings|ejaculation|ejakulate|f u c k|f u c k e r|f4nny|fag|fagging|faggitt|faggot|faggs|fagot|fagots|fags|fanny|fannyflaps|fannyfucker|fanyy|fatass|fcuk|fcuker|fcuking|feck|fecker|felching|fellate|fellatio|fingerfuck|fingerfucked|fingerfucker|fingerfuckers|fingerfucking|fingerfucks|fistfuck|fistfucked|fistfucker|fistfuckers|fistfucking|fistfuckings|fistfucks|flange|fook|fooker|fuck|fucka|fucked|fucker|fuckers|fuckhead|fuckheads|fuckin|fucking|fuckings|fuckingshitmotherfucker|fuckme|fucks|fuckwhit|fuckwit|fudge packer|fudgepacker|fuk|fuker|fukker|fukkin|fuks|fukwhit|fukwit|fux|fux0r|f_u_c_k|gangbang|gangbanged|gangbangs|gaylord|gaysex|goatse|God|god-dam|god-damned|goddamn|goddamned|hardcoresex|hell|heshe|hoar|hoare|hoer|homo|hore|horniest|horny|hotsex|jack-off|jackoff|jap|jerk-off|jism|jiz|jizm|jizz|kawk|knob|knobead|knobed|knobend|knobhead|knobjocky|knobjokey|kock|kondum|kondums|kum|kummer|kumming|kums|kunilingus|l3i\+ch|l3itch|labia|lust|lusting|m0f0|m0fo|m45terbate|ma5terb8|ma5terbate|masochist|master-bate|masterb8|masterbat*|masterbat3|masterbate|masterbation|masterbations|masturbate|mo-fo|mof0|mofo|mothafuck|mothafucka|mothafuckas|mothafuckaz|mothafucked|mothafucker|mothafuckers|mothafuckin|mothafucking|mothafuckings|mothafucks|mother fucker|motherfuck|motherfucked|motherfucker|motherfuckers|motherfuckin|motherfucking|motherfuckings|motherfuckka|motherfucks|muff|mutha|muthafecker|muthafuckker|muther|mutherfucker|n1gga|n1gger|nazi|nigg3r|nigg4h|nigga|niggah|niggas|niggaz|nigger|niggers|nob|nob jokey|nobhead|nobjocky|nobjokey|numbnuts|nutsack|orgasim|orgasims|orgasm|orgasms|p0rn|pawn|pecker|penis|penisfucker|phonesex|phuck|phuk|phuked|phuking|phukked|phukking|phuks|phuq|pigfucker|pimpis|piss|pissed|pisser|pissers|pisses|pissflaps|pissin|pissing|pissoff|poop|porn|porno|pornography|pornos|prick|pricks|pron|pube|pusse|pussi|pussies|pussy|pussys|rectum|retard|rimjaw|rimming|s hit|s.o.b.|sadist|schlong|screwing|scroat|scrote|scrotum|semen|sex|sh!\+|sh!t|sh1t|shag|shagger|shaggin|shagging|shemale|shi\+|shit|shitdick|shite|shited|shitey|shitfuck|shitfull|shithead|shiting|shitings|shits|shitted|shitter|shitters|shitting|shittings|shitty|skank|slut|sluts|smegma|smut|snatch|son-of-a-bitch|spac|spunk|s_h_i_t|t1tt1e5|t1tties|teets|teez|testical|testicle|tit|titfuck|tits|titt|tittie5|tittiefucker|titties|tittyfuck|tittywank|titwank|tosser|turd|tw4t|twat|twathead|twatty|twunt|twunter|v14gra|v1gra|vagina|viagra|vulva|w00se|wang|wank|wanker|wanky|whoar|whore|willies|willy|xrated|xxx)\b/gi;

        /***/
    }),

    /***/ "./node_modules/base64-js/index.js":
    /*!*****************************************!*\
  !*** ./node_modules/base64-js/index.js ***!
  \*****************************************/
    /*! no static exports found */
    /***/ (function (module, exports, __webpack_require__) {

        "use strict";


        exports.byteLength = byteLength
        exports.toByteArray = toByteArray
        exports.fromByteArray = fromByteArray

        var lookup = []
        var revLookup = []
        var Arr = typeof Uint8Array !== 'undefined' ? Uint8Array : Array

        var code = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
        for (var i = 0, len = code.length; i < len; ++i) {
            lookup[i] = code[i]
            revLookup[code.charCodeAt(i)] = i
        }

        // Support decoding URL-safe base64 strings, as Node.js does.
        // See: https://en.wikipedia.org/wiki/Base64#URL_applications
        revLookup['-'.charCodeAt(0)] = 62
        revLookup['_'.charCodeAt(0)] = 63

        function getLens(b64) {
            var len = b64.length

            if (len % 4 > 0) {
                throw new Error('Invalid string. Length must be a multiple of 4')
            }

            // Trim off extra bytes after placeholder bytes are found
            // See: https://github.com/beatgammit/base64-js/issues/42
            var validLen = b64.indexOf('=')
            if (validLen === -1) validLen = len

            var placeHoldersLen = validLen === len
            ? 0
            : 4 - (validLen % 4)

            return [validLen, placeHoldersLen]
        }

        // base64 is 4/3 + up to two characters of the original data
        function byteLength(b64) {
            var lens = getLens(b64)
            var validLen = lens[0]
            var placeHoldersLen = lens[1]
            return ((validLen + placeHoldersLen) * 3 / 4) - placeHoldersLen
        }

        function _byteLength(b64, validLen, placeHoldersLen) {
            return ((validLen + placeHoldersLen) * 3 / 4) - placeHoldersLen
        }

        function toByteArray(b64) {
            var tmp
            var lens = getLens(b64)
            var validLen = lens[0]
            var placeHoldersLen = lens[1]

            var arr = new Arr(_byteLength(b64, validLen, placeHoldersLen))

            var curByte = 0

            // if there are placeholders, only get up to the last complete 4 chars
            var len = placeHoldersLen > 0
            ? validLen - 4
            : validLen

            var i
            for (i = 0; i < len; i += 4) {
                tmp =
                    (revLookup[b64.charCodeAt(i)] << 18) |
                    (revLookup[b64.charCodeAt(i + 1)] << 12) |
                    (revLookup[b64.charCodeAt(i + 2)] << 6) |
                    revLookup[b64.charCodeAt(i + 3)]
                arr[curByte++] = (tmp >> 16) & 0xFF
                arr[curByte++] = (tmp >> 8) & 0xFF
                arr[curByte++] = tmp & 0xFF
            }

            if (placeHoldersLen === 2) {
                tmp =
                    (revLookup[b64.charCodeAt(i)] << 2) |
                    (revLookup[b64.charCodeAt(i + 1)] >> 4)
                arr[curByte++] = tmp & 0xFF
            }

            if (placeHoldersLen === 1) {
                tmp =
                    (revLookup[b64.charCodeAt(i)] << 10) |
                    (revLookup[b64.charCodeAt(i + 1)] << 4) |
                    (revLookup[b64.charCodeAt(i + 2)] >> 2)
                arr[curByte++] = (tmp >> 8) & 0xFF
                arr[curByte++] = tmp & 0xFF
            }

            return arr
        }

        function tripletToBase64(num) {
            return lookup[num >> 18 & 0x3F] +
                lookup[num >> 12 & 0x3F] +
                lookup[num >> 6 & 0x3F] +
                lookup[num & 0x3F]
        }

        function encodeChunk(uint8, start, end) {
            var tmp
            var output = []
            for (var i = start; i < end; i += 3) {
                tmp =
                    ((uint8[i] << 16) & 0xFF0000) +
                    ((uint8[i + 1] << 8) & 0xFF00) +
                    (uint8[i + 2] & 0xFF)
                output.push(tripletToBase64(tmp))
            }
            return output.join('')
        }

        function fromByteArray(uint8) {
            var tmp
            var len = uint8.length
            var extraBytes = len % 3 // if we have 1 byte left, pad 2 bytes
            var parts = []
            var maxChunkLength = 16383 // must be multiple of 3

            // go through the array every three bytes, we'll deal with trailing stuff later
            for (var i = 0, len2 = len - extraBytes; i < len2; i += maxChunkLength) {
                parts.push(encodeChunk(
                    uint8, i, (i + maxChunkLength) > len2 ? len2 : (i + maxChunkLength)
                ))
            }

            // pad the end with zeros, but make sure to not forget the extra bytes
            if (extraBytes === 1) {
                tmp = uint8[len - 1]
                parts.push(
                    lookup[tmp >> 2] +
                    lookup[(tmp << 4) & 0x3F] +
                    '=='
                )
            } else if (extraBytes === 2) {
                tmp = (uint8[len - 2] << 8) + uint8[len - 1]
                parts.push(
                    lookup[tmp >> 10] +
                    lookup[(tmp >> 4) & 0x3F] +
                    lookup[(tmp << 2) & 0x3F] +
                    '='
                )
            }

            return parts.join('')
        }


        /***/
    }),

    /***/ "./node_modules/buffer/index.js":
    /*!**************************************!*\
  !*** ./node_modules/buffer/index.js ***!
  \**************************************/
    /*! no static exports found */
    /***/ (function (module, exports, __webpack_require__) {

        "use strict";
        /* WEBPACK VAR INJECTION */(function (global) {/*!
 * The buffer module from node.js, for the browser.
 *
 * @author   Feross Aboukhadijeh <http://feross.org>
 * @license  MIT
 */
            /* eslint-disable no-proto */



            var base64 = __webpack_require__(/*! base64-js */ "./node_modules/base64-js/index.js")
            var ieee754 = __webpack_require__(/*! ieee754 */ "./node_modules/ieee754/index.js")
            var isArray = __webpack_require__(/*! isarray */ "./node_modules/buffer/node_modules/isarray/index.js")

            exports.Buffer = Buffer
            exports.SlowBuffer = SlowBuffer
            exports.INSPECT_MAX_BYTES = 50

            /**
     * If `Buffer.TYPED_ARRAY_SUPPORT`:
     *   === true    Use Uint8Array implementation (fastest)
     *   === false   Use Object implementation (most compatible, even IE6)
     *
     * Browsers that support typed arrays are IE 10+, Firefox 4+, Chrome 7+, Safari 5.1+,
     * Opera 11.6+, iOS 4.2+.
     *
     * Due to various browser bugs, sometimes the Object implementation will be used even
     * when the browser supports typed arrays.
     *
     * Note:
     *
     *   - Firefox 4-29 lacks support for adding new properties to `Uint8Array` instances,
     *     See: https://bugzilla.mozilla.org/show_bug.cgi?id=695438.
     *
     *   - Chrome 9-10 is missing the `TypedArray.prototype.subarray` function.
     *
     *   - IE10 has a broken `TypedArray.prototype.subarray` function which returns arrays of
     *     incorrect length in some situations.

     * We detect these buggy browsers and set `Buffer.TYPED_ARRAY_SUPPORT` to `false` so they
     * get the Object implementation, which is slower but behaves correctly.
     */
            Buffer.TYPED_ARRAY_SUPPORT = global.TYPED_ARRAY_SUPPORT !== undefined
                ? global.TYPED_ARRAY_SUPPORT
            : typedArraySupport()

            /*
     * Export kMaxLength after typed array support is determined.
     */
            exports.kMaxLength = kMaxLength()

            function typedArraySupport() {
                try {
                    var arr = new Uint8Array(1)
                    arr.__proto__ = { __proto__: Uint8Array.prototype, foo: function () { return 42 } }
                    return arr.foo() === 42 && // typed array instances can be augmented
                        typeof arr.subarray === 'function' && // chrome 9-10 lack `subarray`
                        arr.subarray(1, 1).byteLength === 0 // ie10 has broken `subarray`
                } catch (e) {
                    return false
                }
            }

            function kMaxLength() {
                return Buffer.TYPED_ARRAY_SUPPORT
                    ? 0x7fffffff
                : 0x3fffffff
            }

            function createBuffer(that, length) {
                if (kMaxLength() < length) {
                    throw new RangeError('Invalid typed array length')
                }
                if (Buffer.TYPED_ARRAY_SUPPORT) {
                    // Return an augmented `Uint8Array` instance, for best performance
                    that = new Uint8Array(length)
                    that.__proto__ = Buffer.prototype
                } else {
                    // Fallback: Return an object instance of the Buffer class
                    if (that === null) {
                        that = new Buffer(length)
                    }
                    that.length = length
                }

                return that
            }

            /**
     * The Buffer constructor returns instances of `Uint8Array` that have their
     * prototype changed to `Buffer.prototype`. Furthermore, `Buffer` is a subclass of
     * `Uint8Array`, so the returned instances will have all the node `Buffer` methods
     * and the `Uint8Array` methods. Square bracket notation works as expected -- it
     * returns a single octet.
     *
     * The `Uint8Array` prototype remains unmodified.
     */

            function Buffer(arg, encodingOrOffset, length) {
                if (!Buffer.TYPED_ARRAY_SUPPORT && !(this instanceof Buffer)) {
                    return new Buffer(arg, encodingOrOffset, length)
                }

                // Common case.
                if (typeof arg === 'number') {
                    if (typeof encodingOrOffset === 'string') {
                        throw new Error(
                            'If encoding is specified then the first argument must be a string'
                        )
                    }
                    return allocUnsafe(this, arg)
                }
                return from(this, arg, encodingOrOffset, length)
            }

            Buffer.poolSize = 8192 // not used by this implementation

            // TODO: Legacy, not needed anymore. Remove in next major version.
            Buffer._augment = function (arr) {
                arr.__proto__ = Buffer.prototype
                return arr
            }

            function from(that, value, encodingOrOffset, length) {
                if (typeof value === 'number') {
                    throw new TypeError('"value" argument must not be a number')
                }

                if (typeof ArrayBuffer !== 'undefined' && value instanceof ArrayBuffer) {
                    return fromArrayBuffer(that, value, encodingOrOffset, length)
                }

                if (typeof value === 'string') {
                    return fromString(that, value, encodingOrOffset)
                }

                return fromObject(that, value)
            }

            /**
     * Functionally equivalent to Buffer(arg, encoding) but throws a TypeError
     * if value is a number.
     * Buffer.from(str[, encoding])
     * Buffer.from(array)
     * Buffer.from(buffer)
     * Buffer.from(arrayBuffer[, byteOffset[, length]])
     **/
            Buffer.from = function (value, encodingOrOffset, length) {
                return from(null, value, encodingOrOffset, length)
            }

            if (Buffer.TYPED_ARRAY_SUPPORT) {
                Buffer.prototype.__proto__ = Uint8Array.prototype
                Buffer.__proto__ = Uint8Array
                if (typeof Symbol !== 'undefined' && Symbol.species &&
                    Buffer[Symbol.species] === Buffer) {
                    // Fix subarray() in ES2016. See: https://github.com/feross/buffer/pull/97
                    Object.defineProperty(Buffer, Symbol.species, {
                        value: null,
                        configurable: true
                    })
                }
            }

            function assertSize(size) {
                if (typeof size !== 'number') {
                    throw new TypeError('"size" argument must be a number')
                } else if (size < 0) {
                    throw new RangeError('"size" argument must not be negative')
                }
            }

            function alloc(that, size, fill, encoding) {
                assertSize(size)
                if (size <= 0) {
                    return createBuffer(that, size)
                }
                if (fill !== undefined) {
                    // Only pay attention to encoding if it's a string. This
                    // prevents accidentally sending in a number that would
                    // be interpretted as a start offset.
                    return typeof encoding === 'string'
                        ? createBuffer(that, size).fill(fill, encoding)
                    : createBuffer(that, size).fill(fill)
                }
                return createBuffer(that, size)
            }

            /**
     * Creates a new filled Buffer instance.
     * alloc(size[, fill[, encoding]])
     **/
            Buffer.alloc = function (size, fill, encoding) {
                return alloc(null, size, fill, encoding)
            }

            function allocUnsafe(that, size) {
                assertSize(size)
                that = createBuffer(that, size < 0 ? 0 : checked(size) | 0)
                if (!Buffer.TYPED_ARRAY_SUPPORT) {
                    for (var i = 0; i < size; ++i) {
                        that[i] = 0
                    }
                }
                return that
            }

            /**
     * Equivalent to Buffer(num), by default creates a non-zero-filled Buffer instance.
     * */
            Buffer.allocUnsafe = function (size) {
                return allocUnsafe(null, size)
            }
            /**
     * Equivalent to SlowBuffer(num), by default creates a non-zero-filled Buffer instance.
     */
            Buffer.allocUnsafeSlow = function (size) {
                return allocUnsafe(null, size)
            }

            function fromString(that, string, encoding) {
                if (typeof encoding !== 'string' || encoding === '') {
                    encoding = 'utf8'
                }

                if (!Buffer.isEncoding(encoding)) {
                    throw new TypeError('"encoding" must be a valid string encoding')
                }

                var length = byteLength(string, encoding) | 0
                that = createBuffer(that, length)

                var actual = that.write(string, encoding)

                if (actual !== length) {
                    // Writing a hex string, for example, that contains invalid characters will
                    // cause everything after the first invalid character to be ignored. (e.g.
                    // 'abxxcd' will be treated as 'ab')
                    that = that.slice(0, actual)
                }

                return that
            }

            function fromArrayLike(that, array) {
                var length = array.length < 0 ? 0 : checked(array.length) | 0
                that = createBuffer(that, length)
                for (var i = 0; i < length; i += 1) {
                    that[i] = array[i] & 255
                }
                return that
            }

            function fromArrayBuffer(that, array, byteOffset, length) {
                array.byteLength // this throws if `array` is not a valid ArrayBuffer

                if (byteOffset < 0 || array.byteLength < byteOffset) {
                    throw new RangeError('\'offset\' is out of bounds')
                }

                if (array.byteLength < byteOffset + (length || 0)) {
                    throw new RangeError('\'length\' is out of bounds')
                }

                if (byteOffset === undefined && length === undefined) {
                    array = new Uint8Array(array)
                } else if (length === undefined) {
                    array = new Uint8Array(array, byteOffset)
                } else {
                    array = new Uint8Array(array, byteOffset, length)
                }

                if (Buffer.TYPED_ARRAY_SUPPORT) {
                    // Return an augmented `Uint8Array` instance, for best performance
                    that = array
                    that.__proto__ = Buffer.prototype
                } else {
                    // Fallback: Return an object instance of the Buffer class
                    that = fromArrayLike(that, array)
                }
                return that
            }

            function fromObject(that, obj) {
                if (Buffer.isBuffer(obj)) {
                    var len = checked(obj.length) | 0
                    that = createBuffer(that, len)

                    if (that.length === 0) {
                        return that
                    }

                    obj.copy(that, 0, 0, len)
                    return that
                }

                if (obj) {
                    if ((typeof ArrayBuffer !== 'undefined' &&
                         obj.buffer instanceof ArrayBuffer) || 'length' in obj) {
                        if (typeof obj.length !== 'number' || isnan(obj.length)) {
                            return createBuffer(that, 0)
                        }
                        return fromArrayLike(that, obj)
                    }

                    if (obj.type === 'Buffer' && isArray(obj.data)) {
                        return fromArrayLike(that, obj.data)
                    }
                }

                throw new TypeError('First argument must be a string, Buffer, ArrayBuffer, Array, or array-like object.')
            }

            function checked(length) {
                // Note: cannot use `length < kMaxLength()` here because that fails when
                // length is NaN (which is otherwise coerced to zero.)
                if (length >= kMaxLength()) {
                    throw new RangeError('Attempt to allocate Buffer larger than maximum ' +
                                         'size: 0x' + kMaxLength().toString(16) + ' bytes')
                }
                return length | 0
            }

            function SlowBuffer(length) {
                if (+length != length) { // eslint-disable-line eqeqeq
                    length = 0
                }
                return Buffer.alloc(+length)
            }

            Buffer.isBuffer = function isBuffer(b) {
                return !!(b != null && b._isBuffer)
            }

            Buffer.compare = function compare(a, b) {
                if (!Buffer.isBuffer(a) || !Buffer.isBuffer(b)) {
                    throw new TypeError('Arguments must be Buffers')
                }

                if (a === b) return 0

                var x = a.length
                var y = b.length

                for (var i = 0, len = Math.min(x, y); i < len; ++i) {
                    if (a[i] !== b[i]) {
                        x = a[i]
                        y = b[i]
                        break
                    }
                }

                if (x < y) return -1
                if (y < x) return 1
                return 0
            }

            Buffer.isEncoding = function isEncoding(encoding) {
                switch (String(encoding).toLowerCase()) {
                    case 'hex':
                    case 'utf8':
                    case 'utf-8':
                    case 'ascii':
                    case 'latin1':
                    case 'binary':
                    case 'base64':
                    case 'ucs2':
                    case 'ucs-2':
                    case 'utf16le':
                    case 'utf-16le':
                        return true
                    default:
                        return false
                }
            }

            Buffer.concat = function concat(list, length) {
                if (!isArray(list)) {
                    throw new TypeError('"list" argument must be an Array of Buffers')
                }

                if (list.length === 0) {
                    return Buffer.alloc(0)
                }

                var i
                if (length === undefined) {
                    length = 0
                    for (i = 0; i < list.length; ++i) {
                        length += list[i].length
                    }
                }

                var buffer = Buffer.allocUnsafe(length)
                var pos = 0
                for (i = 0; i < list.length; ++i) {
                    var buf = list[i]
                    if (!Buffer.isBuffer(buf)) {
                        throw new TypeError('"list" argument must be an Array of Buffers')
                    }
                    buf.copy(buffer, pos)
                    pos += buf.length
                }
                return buffer
            }

            function byteLength(string, encoding) {
                if (Buffer.isBuffer(string)) {
                    return string.length
                }
                if (typeof ArrayBuffer !== 'undefined' && typeof ArrayBuffer.isView === 'function' &&
                    (ArrayBuffer.isView(string) || string instanceof ArrayBuffer)) {
                    return string.byteLength
                }
                if (typeof string !== 'string') {
                    string = '' + string
                }

                var len = string.length
                if (len === 0) return 0

                // Use a for loop to avoid recursion
                var loweredCase = false
                for (; ;) {
                    switch (encoding) {
                        case 'ascii':
                        case 'latin1':
                        case 'binary':
                            return len
                        case 'utf8':
                        case 'utf-8':
                        case undefined:
                            return utf8ToBytes(string).length
                        case 'ucs2':
                        case 'ucs-2':
                        case 'utf16le':
                        case 'utf-16le':
                            return len * 2
                        case 'hex':
                            return len >>> 1
                        case 'base64':
                            return base64ToBytes(string).length
                        default:
                            if (loweredCase) return utf8ToBytes(string).length // assume utf8
                            encoding = ('' + encoding).toLowerCase()
                            loweredCase = true
                    }
                }
            }
            Buffer.byteLength = byteLength

            function slowToString(encoding, start, end) {
                var loweredCase = false

                // No need to verify that "this.length <= MAX_UINT32" since it's a read-only
                // property of a typed array.

                // This behaves neither like String nor Uint8Array in that we set start/end
                // to their upper/lower bounds if the value passed is out of range.
                // undefined is handled specially as per ECMA-262 6th Edition,
                // Section 13.3.3.7 Runtime Semantics: KeyedBindingInitialization.
                if (start === undefined || start < 0) {
                    start = 0
                }
                // Return early if start > this.length. Done here to prevent potential uint32
                // coercion fail below.
                if (start > this.length) {
                    return ''
                }

                if (end === undefined || end > this.length) {
                    end = this.length
                }

                if (end <= 0) {
                    return ''
                }

                // Force coersion to uint32. This will also coerce falsey/NaN values to 0.
                end >>>= 0
                start >>>= 0

                if (end <= start) {
                    return ''
                }

                if (!encoding) encoding = 'utf8'

                while (true) {
                    switch (encoding) {
                        case 'hex':
                            return hexSlice(this, start, end)

                        case 'utf8':
                        case 'utf-8':
                            return utf8Slice(this, start, end)

                        case 'ascii':
                            return asciiSlice(this, start, end)

                        case 'latin1':
                        case 'binary':
                            return latin1Slice(this, start, end)

                        case 'base64':
                            return base64Slice(this, start, end)

                        case 'ucs2':
                        case 'ucs-2':
                        case 'utf16le':
                        case 'utf-16le':
                            return utf16leSlice(this, start, end)

                        default:
                            if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
                            encoding = (encoding + '').toLowerCase()
                            loweredCase = true
                    }
                }
            }

            // The property is used by `Buffer.isBuffer` and `is-buffer` (in Safari 5-7) to detect
            // Buffer instances.
            Buffer.prototype._isBuffer = true

            function swap(b, n, m) {
                var i = b[n]
                b[n] = b[m]
                b[m] = i
            }

            Buffer.prototype.swap16 = function swap16() {
                var len = this.length
                if (len % 2 !== 0) {
                    throw new RangeError('Buffer size must be a multiple of 16-bits')
                }
                for (var i = 0; i < len; i += 2) {
                    swap(this, i, i + 1)
                }
                return this
            }

            Buffer.prototype.swap32 = function swap32() {
                var len = this.length
                if (len % 4 !== 0) {
                    throw new RangeError('Buffer size must be a multiple of 32-bits')
                }
                for (var i = 0; i < len; i += 4) {
                    swap(this, i, i + 3)
                    swap(this, i + 1, i + 2)
                }
                return this
            }

            Buffer.prototype.swap64 = function swap64() {
                var len = this.length
                if (len % 8 !== 0) {
                    throw new RangeError('Buffer size must be a multiple of 64-bits')
                }
                for (var i = 0; i < len; i += 8) {
                    swap(this, i, i + 7)
                    swap(this, i + 1, i + 6)
                    swap(this, i + 2, i + 5)
                    swap(this, i + 3, i + 4)
                }
                return this
            }

            Buffer.prototype.toString = function toString() {
                var length = this.length | 0
                if (length === 0) return ''
                if (arguments.length === 0) return utf8Slice(this, 0, length)
                return slowToString.apply(this, arguments)
            }

            Buffer.prototype.equals = function equals(b) {
                if (!Buffer.isBuffer(b)) throw new TypeError('Argument must be a Buffer')
                if (this === b) return true
                return Buffer.compare(this, b) === 0
            }

            Buffer.prototype.inspect = function inspect() {
                var str = ''
                var max = exports.INSPECT_MAX_BYTES
                if (this.length > 0) {
                    str = this.toString('hex', 0, max).match(/.{2}/g).join(' ')
                    if (this.length > max) str += ' ... '
                }
                return '<Buffer ' + str + '>'
            }

            Buffer.prototype.compare = function compare(target, start, end, thisStart, thisEnd) {
                if (!Buffer.isBuffer(target)) {
                    throw new TypeError('Argument must be a Buffer')
                }

                if (start === undefined) {
                    start = 0
                }
                if (end === undefined) {
                    end = target ? target.length : 0
                }
                if (thisStart === undefined) {
                    thisStart = 0
                }
                if (thisEnd === undefined) {
                    thisEnd = this.length
                }

                if (start < 0 || end > target.length || thisStart < 0 || thisEnd > this.length) {
                    throw new RangeError('out of range index')
                }

                if (thisStart >= thisEnd && start >= end) {
                    return 0
                }
                if (thisStart >= thisEnd) {
                    return -1
                }
                if (start >= end) {
                    return 1
                }

                start >>>= 0
                end >>>= 0
                thisStart >>>= 0
                thisEnd >>>= 0

                if (this === target) return 0

                var x = thisEnd - thisStart
                var y = end - start
                var len = Math.min(x, y)

                var thisCopy = this.slice(thisStart, thisEnd)
                var targetCopy = target.slice(start, end)

                for (var i = 0; i < len; ++i) {
                    if (thisCopy[i] !== targetCopy[i]) {
                        x = thisCopy[i]
                        y = targetCopy[i]
                        break
                    }
                }

                if (x < y) return -1
                if (y < x) return 1
                return 0
            }

            // Finds either the first index of `val` in `buffer` at offset >= `byteOffset`,
            // OR the last index of `val` in `buffer` at offset <= `byteOffset`.
            //
            // Arguments:
            // - buffer - a Buffer to search
            // - val - a string, Buffer, or number
            // - byteOffset - an index into `buffer`; will be clamped to an int32
            // - encoding - an optional encoding, relevant is val is a string
            // - dir - true for indexOf, false for lastIndexOf
            function bidirectionalIndexOf(buffer, val, byteOffset, encoding, dir) {
                // Empty buffer means no match
                if (buffer.length === 0) return -1

                // Normalize byteOffset
                if (typeof byteOffset === 'string') {
                    encoding = byteOffset
                    byteOffset = 0
                } else if (byteOffset > 0x7fffffff) {
                    byteOffset = 0x7fffffff
                } else if (byteOffset < -0x80000000) {
                    byteOffset = -0x80000000
                }
                byteOffset = +byteOffset  // Coerce to Number.
                if (isNaN(byteOffset)) {
                    // byteOffset: it it's undefined, null, NaN, "foo", etc, search whole buffer
                    byteOffset = dir ? 0 : (buffer.length - 1)
                }

                // Normalize byteOffset: negative offsets start from the end of the buffer
                if (byteOffset < 0) byteOffset = buffer.length + byteOffset
                if (byteOffset >= buffer.length) {
                    if (dir) return -1
                    else byteOffset = buffer.length - 1
                } else if (byteOffset < 0) {
                    if (dir) byteOffset = 0
                    else return -1
                }

                // Normalize val
                if (typeof val === 'string') {
                    val = Buffer.from(val, encoding)
                }

                // Finally, search either indexOf (if dir is true) or lastIndexOf
                if (Buffer.isBuffer(val)) {
                    // Special case: looking for empty string/buffer always fails
                    if (val.length === 0) {
                        return -1
                    }
                    return arrayIndexOf(buffer, val, byteOffset, encoding, dir)
                } else if (typeof val === 'number') {
                    val = val & 0xFF // Search for a byte value [0-255]
                    if (Buffer.TYPED_ARRAY_SUPPORT &&
                        typeof Uint8Array.prototype.indexOf === 'function') {
                        if (dir) {
                            return Uint8Array.prototype.indexOf.call(buffer, val, byteOffset)
                        } else {
                            return Uint8Array.prototype.lastIndexOf.call(buffer, val, byteOffset)
                        }
                    }
                    return arrayIndexOf(buffer, [val], byteOffset, encoding, dir)
                }

                throw new TypeError('val must be string, number or Buffer')
            }

            function arrayIndexOf(arr, val, byteOffset, encoding, dir) {
                var indexSize = 1
                var arrLength = arr.length
                var valLength = val.length

                if (encoding !== undefined) {
                    encoding = String(encoding).toLowerCase()
                    if (encoding === 'ucs2' || encoding === 'ucs-2' ||
                        encoding === 'utf16le' || encoding === 'utf-16le') {
                        if (arr.length < 2 || val.length < 2) {
                            return -1
                        }
                        indexSize = 2
                        arrLength /= 2
                        valLength /= 2
                        byteOffset /= 2
                    }
                }

                function read(buf, i) {
                    if (indexSize === 1) {
                        return buf[i]
                    } else {
                        return buf.readUInt16BE(i * indexSize)
                    }
                }

                var i
                if (dir) {
                    var foundIndex = -1
                    for (i = byteOffset; i < arrLength; i++) {
                        if (read(arr, i) === read(val, foundIndex === -1 ? 0 : i - foundIndex)) {
                            if (foundIndex === -1) foundIndex = i
                            if (i - foundIndex + 1 === valLength) return foundIndex * indexSize
                        } else {
                            if (foundIndex !== -1) i -= i - foundIndex
                            foundIndex = -1
                        }
                    }
                } else {
                    if (byteOffset + valLength > arrLength) byteOffset = arrLength - valLength
                    for (i = byteOffset; i >= 0; i--) {
                        var found = true
                        for (var j = 0; j < valLength; j++) {
                            if (read(arr, i + j) !== read(val, j)) {
                                found = false
                                break
                            }
                        }
                        if (found) return i
                    }
                }

                return -1
            }

            Buffer.prototype.includes = function includes(val, byteOffset, encoding) {
                return this.indexOf(val, byteOffset, encoding) !== -1
            }

            Buffer.prototype.indexOf = function indexOf(val, byteOffset, encoding) {
                return bidirectionalIndexOf(this, val, byteOffset, encoding, true)
            }

            Buffer.prototype.lastIndexOf = function lastIndexOf(val, byteOffset, encoding) {
                return bidirectionalIndexOf(this, val, byteOffset, encoding, false)
            }

            function hexWrite(buf, string, offset, length) {
                offset = Number(offset) || 0
                var remaining = buf.length - offset
                if (!length) {
                    length = remaining
                } else {
                    length = Number(length)
                    if (length > remaining) {
                        length = remaining
                    }
                }

                // must be an even number of digits
                var strLen = string.length
                if (strLen % 2 !== 0) throw new TypeError('Invalid hex string')

                if (length > strLen / 2) {
                    length = strLen / 2
                }
                for (var i = 0; i < length; ++i) {
                    var parsed = parseInt(string.substr(i * 2, 2), 16)
                    if (isNaN(parsed)) return i
                    buf[offset + i] = parsed
                }
                return i
            }

            function utf8Write(buf, string, offset, length) {
                return blitBuffer(utf8ToBytes(string, buf.length - offset), buf, offset, length)
            }

            function asciiWrite(buf, string, offset, length) {
                return blitBuffer(asciiToBytes(string), buf, offset, length)
            }

            function latin1Write(buf, string, offset, length) {
                return asciiWrite(buf, string, offset, length)
            }

            function base64Write(buf, string, offset, length) {
                return blitBuffer(base64ToBytes(string), buf, offset, length)
            }

            function ucs2Write(buf, string, offset, length) {
                return blitBuffer(utf16leToBytes(string, buf.length - offset), buf, offset, length)
            }

            Buffer.prototype.write = function write(string, offset, length, encoding) {
                // Buffer#write(string)
                if (offset === undefined) {
                    encoding = 'utf8'
                    length = this.length
                    offset = 0
                    // Buffer#write(string, encoding)
                } else if (length === undefined && typeof offset === 'string') {
                    encoding = offset
                    length = this.length
                    offset = 0
                    // Buffer#write(string, offset[, length][, encoding])
                } else if (isFinite(offset)) {
                    offset = offset | 0
                    if (isFinite(length)) {
                        length = length | 0
                        if (encoding === undefined) encoding = 'utf8'
                    } else {
                        encoding = length
                        length = undefined
                    }
                    // legacy write(string, encoding, offset, length) - remove in v0.13
                } else {
                    throw new Error(
                        'Buffer.write(string, encoding, offset[, length]) is no longer supported'
                    )
                }

                var remaining = this.length - offset
                if (length === undefined || length > remaining) length = remaining

                if ((string.length > 0 && (length < 0 || offset < 0)) || offset > this.length) {
                    throw new RangeError('Attempt to write outside buffer bounds')
                }

                if (!encoding) encoding = 'utf8'

                var loweredCase = false
                for (; ;) {
                    switch (encoding) {
                        case 'hex':
                            return hexWrite(this, string, offset, length)

                        case 'utf8':
                        case 'utf-8':
                            return utf8Write(this, string, offset, length)

                        case 'ascii':
                            return asciiWrite(this, string, offset, length)

                        case 'latin1':
                        case 'binary':
                            return latin1Write(this, string, offset, length)

                        case 'base64':
                            // Warning: maxLength not taken into account in base64Write
                            return base64Write(this, string, offset, length)

                        case 'ucs2':
                        case 'ucs-2':
                        case 'utf16le':
                        case 'utf-16le':
                            return ucs2Write(this, string, offset, length)

                        default:
                            if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
                            encoding = ('' + encoding).toLowerCase()
                            loweredCase = true
                    }
                }
            }

            Buffer.prototype.toJSON = function toJSON() {
                return {
                    type: 'Buffer',
                    data: Array.prototype.slice.call(this._arr || this, 0)
                }
            }

            function base64Slice(buf, start, end) {
                if (start === 0 && end === buf.length) {
                    return base64.fromByteArray(buf)
                } else {
                    return base64.fromByteArray(buf.slice(start, end))
                }
            }

            function utf8Slice(buf, start, end) {
                end = Math.min(buf.length, end)
                var res = []

                var i = start
                while (i < end) {
                    var firstByte = buf[i]
                    var codePoint = null
                    var bytesPerSequence = (firstByte > 0xEF) ? 4
                    : (firstByte > 0xDF) ? 3
                    : (firstByte > 0xBF) ? 2
                    : 1

                    if (i + bytesPerSequence <= end) {
                        var secondByte, thirdByte, fourthByte, tempCodePoint

                        switch (bytesPerSequence) {
                            case 1:
                                if (firstByte < 0x80) {
                                    codePoint = firstByte
                                }
                                break
                            case 2:
                                secondByte = buf[i + 1]
                                if ((secondByte & 0xC0) === 0x80) {
                                    tempCodePoint = (firstByte & 0x1F) << 0x6 | (secondByte & 0x3F)
                                    if (tempCodePoint > 0x7F) {
                                        codePoint = tempCodePoint
                                    }
                                }
                                break
                            case 3:
                                secondByte = buf[i + 1]
                                thirdByte = buf[i + 2]
                                if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80) {
                                    tempCodePoint = (firstByte & 0xF) << 0xC | (secondByte & 0x3F) << 0x6 | (thirdByte & 0x3F)
                                    if (tempCodePoint > 0x7FF && (tempCodePoint < 0xD800 || tempCodePoint > 0xDFFF)) {
                                        codePoint = tempCodePoint
                                    }
                                }
                                break
                            case 4:
                                secondByte = buf[i + 1]
                                thirdByte = buf[i + 2]
                                fourthByte = buf[i + 3]
                                if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80 && (fourthByte & 0xC0) === 0x80) {
                                    tempCodePoint = (firstByte & 0xF) << 0x12 | (secondByte & 0x3F) << 0xC | (thirdByte & 0x3F) << 0x6 | (fourthByte & 0x3F)
                                    if (tempCodePoint > 0xFFFF && tempCodePoint < 0x110000) {
                                        codePoint = tempCodePoint
                                    }
                                }
                        }
                    }

                    if (codePoint === null) {
                        // we did not generate a valid codePoint so insert a
                        // replacement char (U+FFFD) and advance only 1 byte
                        codePoint = 0xFFFD
                        bytesPerSequence = 1
                    } else if (codePoint > 0xFFFF) {
                        // encode to utf16 (surrogate pair dance)
                        codePoint -= 0x10000
                        res.push(codePoint >>> 10 & 0x3FF | 0xD800)
                        codePoint = 0xDC00 | codePoint & 0x3FF
                    }

                    res.push(codePoint)
                    i += bytesPerSequence
                }

                return decodeCodePointsArray(res)
            }

            // Based on http://stackoverflow.com/a/22747272/680742, the browser with
            // the lowest limit is Chrome, with 0x10000 args.
            // We go 1 magnitude less, for safety
            var MAX_ARGUMENTS_LENGTH = 0x1000

            function decodeCodePointsArray(codePoints) {
                var len = codePoints.length
                if (len <= MAX_ARGUMENTS_LENGTH) {
                    return String.fromCharCode.apply(String, codePoints) // avoid extra slice()
                }

                // Decode in chunks to avoid "call stack size exceeded".
                var res = ''
                var i = 0
                while (i < len) {
                    res += String.fromCharCode.apply(
                        String,
                        codePoints.slice(i, i += MAX_ARGUMENTS_LENGTH)
                    )
                }
                return res
            }

            function asciiSlice(buf, start, end) {
                var ret = ''
                end = Math.min(buf.length, end)

                for (var i = start; i < end; ++i) {
                    ret += String.fromCharCode(buf[i] & 0x7F)
                }
                return ret
            }

            function latin1Slice(buf, start, end) {
                var ret = ''
                end = Math.min(buf.length, end)

                for (var i = start; i < end; ++i) {
                    ret += String.fromCharCode(buf[i])
                }
                return ret
            }

            function hexSlice(buf, start, end) {
                var len = buf.length

                if (!start || start < 0) start = 0
                if (!end || end < 0 || end > len) end = len

                var out = ''
                for (var i = start; i < end; ++i) {
                    out += toHex(buf[i])
                }
                return out
            }

            function utf16leSlice(buf, start, end) {
                var bytes = buf.slice(start, end)
                var res = ''
                for (var i = 0; i < bytes.length; i += 2) {
                    res += String.fromCharCode(bytes[i] + bytes[i + 1] * 256)
                }
                return res
            }

            Buffer.prototype.slice = function slice(start, end) {
                var len = this.length
                start = ~~start
                end = end === undefined ? len : ~~end

                if (start < 0) {
                    start += len
                    if (start < 0) start = 0
                } else if (start > len) {
                    start = len
                }

                if (end < 0) {
                    end += len
                    if (end < 0) end = 0
                } else if (end > len) {
                    end = len
                }

                if (end < start) end = start

                var newBuf
                if (Buffer.TYPED_ARRAY_SUPPORT) {
                    newBuf = this.subarray(start, end)
                    newBuf.__proto__ = Buffer.prototype
                } else {
                    var sliceLen = end - start
                    newBuf = new Buffer(sliceLen, undefined)
                    for (var i = 0; i < sliceLen; ++i) {
                        newBuf[i] = this[i + start]
                    }
                }

                return newBuf
            }

            /*
     * Need to make sure that buffer isn't trying to write out of bounds.
     */
            function checkOffset(offset, ext, length) {
                if ((offset % 1) !== 0 || offset < 0) throw new RangeError('offset is not uint')
                if (offset + ext > length) throw new RangeError('Trying to access beyond buffer length')
            }

            Buffer.prototype.readUIntLE = function readUIntLE(offset, byteLength, noAssert) {
                offset = offset | 0
                byteLength = byteLength | 0
                if (!noAssert) checkOffset(offset, byteLength, this.length)

                var val = this[offset]
                var mul = 1
                var i = 0
                while (++i < byteLength && (mul *= 0x100)) {
                    val += this[offset + i] * mul
                }

                return val
            }

            Buffer.prototype.readUIntBE = function readUIntBE(offset, byteLength, noAssert) {
                offset = offset | 0
                byteLength = byteLength | 0
                if (!noAssert) {
                    checkOffset(offset, byteLength, this.length)
                }

                var val = this[offset + --byteLength]
                var mul = 1
                while (byteLength > 0 && (mul *= 0x100)) {
                    val += this[offset + --byteLength] * mul
                }

                return val
            }

            Buffer.prototype.readUInt8 = function readUInt8(offset, noAssert) {
                if (!noAssert) checkOffset(offset, 1, this.length)
                return this[offset]
            }

            Buffer.prototype.readUInt16LE = function readUInt16LE(offset, noAssert) {
                if (!noAssert) checkOffset(offset, 2, this.length)
                return this[offset] | (this[offset + 1] << 8)
            }

            Buffer.prototype.readUInt16BE = function readUInt16BE(offset, noAssert) {
                if (!noAssert) checkOffset(offset, 2, this.length)
                return (this[offset] << 8) | this[offset + 1]
            }

            Buffer.prototype.readUInt32LE = function readUInt32LE(offset, noAssert) {
                if (!noAssert) checkOffset(offset, 4, this.length)

                return ((this[offset]) |
                        (this[offset + 1] << 8) |
                        (this[offset + 2] << 16)) +
                    (this[offset + 3] * 0x1000000)
            }

            Buffer.prototype.readUInt32BE = function readUInt32BE(offset, noAssert) {
                if (!noAssert) checkOffset(offset, 4, this.length)

                return (this[offset] * 0x1000000) +
                    ((this[offset + 1] << 16) |
                     (this[offset + 2] << 8) |
                     this[offset + 3])
            }

            Buffer.prototype.readIntLE = function readIntLE(offset, byteLength, noAssert) {
                offset = offset | 0
                byteLength = byteLength | 0
                if (!noAssert) checkOffset(offset, byteLength, this.length)

                var val = this[offset]
                var mul = 1
                var i = 0
                while (++i < byteLength && (mul *= 0x100)) {
                    val += this[offset + i] * mul
                }
                mul *= 0x80

                if (val >= mul) val -= Math.pow(2, 8 * byteLength)

                return val
            }

            Buffer.prototype.readIntBE = function readIntBE(offset, byteLength, noAssert) {
                offset = offset | 0
                byteLength = byteLength | 0
                if (!noAssert) checkOffset(offset, byteLength, this.length)

                var i = byteLength
                var mul = 1
                var val = this[offset + --i]
                while (i > 0 && (mul *= 0x100)) {
                    val += this[offset + --i] * mul
                }
                mul *= 0x80

                if (val >= mul) val -= Math.pow(2, 8 * byteLength)

                return val
            }

            Buffer.prototype.readInt8 = function readInt8(offset, noAssert) {
                if (!noAssert) checkOffset(offset, 1, this.length)
                if (!(this[offset] & 0x80)) return (this[offset])
                return ((0xff - this[offset] + 1) * -1)
            }

            Buffer.prototype.readInt16LE = function readInt16LE(offset, noAssert) {
                if (!noAssert) checkOffset(offset, 2, this.length)
                var val = this[offset] | (this[offset + 1] << 8)
                return (val & 0x8000) ? val | 0xFFFF0000 : val
            }

            Buffer.prototype.readInt16BE = function readInt16BE(offset, noAssert) {
                if (!noAssert) checkOffset(offset, 2, this.length)
                var val = this[offset + 1] | (this[offset] << 8)
                return (val & 0x8000) ? val | 0xFFFF0000 : val
            }

            Buffer.prototype.readInt32LE = function readInt32LE(offset, noAssert) {
                if (!noAssert) checkOffset(offset, 4, this.length)

                return (this[offset]) |
                    (this[offset + 1] << 8) |
                    (this[offset + 2] << 16) |
                    (this[offset + 3] << 24)
            }

            Buffer.prototype.readInt32BE = function readInt32BE(offset, noAssert) {
                if (!noAssert) checkOffset(offset, 4, this.length)

                return (this[offset] << 24) |
                    (this[offset + 1] << 16) |
                    (this[offset + 2] << 8) |
                    (this[offset + 3])
            }

            Buffer.prototype.readFloatLE = function readFloatLE(offset, noAssert) {
                if (!noAssert) checkOffset(offset, 4, this.length)
                return ieee754.read(this, offset, true, 23, 4)
            }

            Buffer.prototype.readFloatBE = function readFloatBE(offset, noAssert) {
                if (!noAssert) checkOffset(offset, 4, this.length)
                return ieee754.read(this, offset, false, 23, 4)
            }

            Buffer.prototype.readDoubleLE = function readDoubleLE(offset, noAssert) {
                if (!noAssert) checkOffset(offset, 8, this.length)
                return ieee754.read(this, offset, true, 52, 8)
            }

            Buffer.prototype.readDoubleBE = function readDoubleBE(offset, noAssert) {
                if (!noAssert) checkOffset(offset, 8, this.length)
                return ieee754.read(this, offset, false, 52, 8)
            }

            function checkInt(buf, value, offset, ext, max, min) {
                if (!Buffer.isBuffer(buf)) throw new TypeError('"buffer" argument must be a Buffer instance')
                if (value > max || value < min) throw new RangeError('"value" argument is out of bounds')
                if (offset + ext > buf.length) throw new RangeError('Index out of range')
            }

            Buffer.prototype.writeUIntLE = function writeUIntLE(value, offset, byteLength, noAssert) {
                value = +value
                offset = offset | 0
                byteLength = byteLength | 0
                if (!noAssert) {
                    var maxBytes = Math.pow(2, 8 * byteLength) - 1
                    checkInt(this, value, offset, byteLength, maxBytes, 0)
                }

                var mul = 1
                var i = 0
                this[offset] = value & 0xFF
                while (++i < byteLength && (mul *= 0x100)) {
                    this[offset + i] = (value / mul) & 0xFF
                }

                return offset + byteLength
            }

            Buffer.prototype.writeUIntBE = function writeUIntBE(value, offset, byteLength, noAssert) {
                value = +value
                offset = offset | 0
                byteLength = byteLength | 0
                if (!noAssert) {
                    var maxBytes = Math.pow(2, 8 * byteLength) - 1
                    checkInt(this, value, offset, byteLength, maxBytes, 0)
                }

                var i = byteLength - 1
                var mul = 1
                this[offset + i] = value & 0xFF
                while (--i >= 0 && (mul *= 0x100)) {
                    this[offset + i] = (value / mul) & 0xFF
                }

                return offset + byteLength
            }

            Buffer.prototype.writeUInt8 = function writeUInt8(value, offset, noAssert) {
                value = +value
                offset = offset | 0
                if (!noAssert) checkInt(this, value, offset, 1, 0xff, 0)
                if (!Buffer.TYPED_ARRAY_SUPPORT) value = Math.floor(value)
                this[offset] = (value & 0xff)
                return offset + 1
            }

            function objectWriteUInt16(buf, value, offset, littleEndian) {
                if (value < 0) value = 0xffff + value + 1
                for (var i = 0, j = Math.min(buf.length - offset, 2); i < j; ++i) {
                    buf[offset + i] = (value & (0xff << (8 * (littleEndian ? i : 1 - i)))) >>>
                        (littleEndian ? i : 1 - i) * 8
                }
            }

            Buffer.prototype.writeUInt16LE = function writeUInt16LE(value, offset, noAssert) {
                value = +value
                offset = offset | 0
                if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0)
                if (Buffer.TYPED_ARRAY_SUPPORT) {
                    this[offset] = (value & 0xff)
                    this[offset + 1] = (value >>> 8)
                } else {
                    objectWriteUInt16(this, value, offset, true)
                }
                return offset + 2
            }

            Buffer.prototype.writeUInt16BE = function writeUInt16BE(value, offset, noAssert) {
                value = +value
                offset = offset | 0
                if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0)
                if (Buffer.TYPED_ARRAY_SUPPORT) {
                    this[offset] = (value >>> 8)
                    this[offset + 1] = (value & 0xff)
                } else {
                    objectWriteUInt16(this, value, offset, false)
                }
                return offset + 2
            }

            function objectWriteUInt32(buf, value, offset, littleEndian) {
                if (value < 0) value = 0xffffffff + value + 1
                for (var i = 0, j = Math.min(buf.length - offset, 4); i < j; ++i) {
                    buf[offset + i] = (value >>> (littleEndian ? i : 3 - i) * 8) & 0xff
                }
            }

            Buffer.prototype.writeUInt32LE = function writeUInt32LE(value, offset, noAssert) {
                value = +value
                offset = offset | 0
                if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0)
                if (Buffer.TYPED_ARRAY_SUPPORT) {
                    this[offset + 3] = (value >>> 24)
                    this[offset + 2] = (value >>> 16)
                    this[offset + 1] = (value >>> 8)
                    this[offset] = (value & 0xff)
                } else {
                    objectWriteUInt32(this, value, offset, true)
                }
                return offset + 4
            }

            Buffer.prototype.writeUInt32BE = function writeUInt32BE(value, offset, noAssert) {
                value = +value
                offset = offset | 0
                if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0)
                if (Buffer.TYPED_ARRAY_SUPPORT) {
                    this[offset] = (value >>> 24)
                    this[offset + 1] = (value >>> 16)
                    this[offset + 2] = (value >>> 8)
                    this[offset + 3] = (value & 0xff)
                } else {
                    objectWriteUInt32(this, value, offset, false)
                }
                return offset + 4
            }

            Buffer.prototype.writeIntLE = function writeIntLE(value, offset, byteLength, noAssert) {
                value = +value
                offset = offset | 0
                if (!noAssert) {
                    var limit = Math.pow(2, 8 * byteLength - 1)

                    checkInt(this, value, offset, byteLength, limit - 1, -limit)
                }

                var i = 0
                var mul = 1
                var sub = 0
                this[offset] = value & 0xFF
                while (++i < byteLength && (mul *= 0x100)) {
                    if (value < 0 && sub === 0 && this[offset + i - 1] !== 0) {
                        sub = 1
                    }
                    this[offset + i] = ((value / mul) >> 0) - sub & 0xFF
                }

                return offset + byteLength
            }

            Buffer.prototype.writeIntBE = function writeIntBE(value, offset, byteLength, noAssert) {
                value = +value
                offset = offset | 0
                if (!noAssert) {
                    var limit = Math.pow(2, 8 * byteLength - 1)

                    checkInt(this, value, offset, byteLength, limit - 1, -limit)
                }

                var i = byteLength - 1
                var mul = 1
                var sub = 0
                this[offset + i] = value & 0xFF
                while (--i >= 0 && (mul *= 0x100)) {
                    if (value < 0 && sub === 0 && this[offset + i + 1] !== 0) {
                        sub = 1
                    }
                    this[offset + i] = ((value / mul) >> 0) - sub & 0xFF
                }

                return offset + byteLength
            }

            Buffer.prototype.writeInt8 = function writeInt8(value, offset, noAssert) {
                value = +value
                offset = offset | 0
                if (!noAssert) checkInt(this, value, offset, 1, 0x7f, -0x80)
                if (!Buffer.TYPED_ARRAY_SUPPORT) value = Math.floor(value)
                if (value < 0) value = 0xff + value + 1
                this[offset] = (value & 0xff)
                return offset + 1
            }

            Buffer.prototype.writeInt16LE = function writeInt16LE(value, offset, noAssert) {
                value = +value
                offset = offset | 0
                if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000)
                if (Buffer.TYPED_ARRAY_SUPPORT) {
                    this[offset] = (value & 0xff)
                    this[offset + 1] = (value >>> 8)
                } else {
                    objectWriteUInt16(this, value, offset, true)
                }
                return offset + 2
            }

            Buffer.prototype.writeInt16BE = function writeInt16BE(value, offset, noAssert) {
                value = +value
                offset = offset | 0
                if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000)
                if (Buffer.TYPED_ARRAY_SUPPORT) {
                    this[offset] = (value >>> 8)
                    this[offset + 1] = (value & 0xff)
                } else {
                    objectWriteUInt16(this, value, offset, false)
                }
                return offset + 2
            }

            Buffer.prototype.writeInt32LE = function writeInt32LE(value, offset, noAssert) {
                value = +value
                offset = offset | 0
                if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
                if (Buffer.TYPED_ARRAY_SUPPORT) {
                    this[offset] = (value & 0xff)
                    this[offset + 1] = (value >>> 8)
                    this[offset + 2] = (value >>> 16)
                    this[offset + 3] = (value >>> 24)
                } else {
                    objectWriteUInt32(this, value, offset, true)
                }
                return offset + 4
            }

            Buffer.prototype.writeInt32BE = function writeInt32BE(value, offset, noAssert) {
                value = +value
                offset = offset | 0
                if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
                if (value < 0) value = 0xffffffff + value + 1
                if (Buffer.TYPED_ARRAY_SUPPORT) {
                    this[offset] = (value >>> 24)
                    this[offset + 1] = (value >>> 16)
                    this[offset + 2] = (value >>> 8)
                    this[offset + 3] = (value & 0xff)
                } else {
                    objectWriteUInt32(this, value, offset, false)
                }
                return offset + 4
            }

            function checkIEEE754(buf, value, offset, ext, max, min) {
                if (offset + ext > buf.length) throw new RangeError('Index out of range')
                if (offset < 0) throw new RangeError('Index out of range')
            }

            function writeFloat(buf, value, offset, littleEndian, noAssert) {
                if (!noAssert) {
                    checkIEEE754(buf, value, offset, 4, 3.4028234663852886e+38, -3.4028234663852886e+38)
                }
                ieee754.write(buf, value, offset, littleEndian, 23, 4)
                return offset + 4
            }

            Buffer.prototype.writeFloatLE = function writeFloatLE(value, offset, noAssert) {
                return writeFloat(this, value, offset, true, noAssert)
            }

            Buffer.prototype.writeFloatBE = function writeFloatBE(value, offset, noAssert) {
                return writeFloat(this, value, offset, false, noAssert)
            }

            function writeDouble(buf, value, offset, littleEndian, noAssert) {
                if (!noAssert) {
                    checkIEEE754(buf, value, offset, 8, 1.7976931348623157E+308, -1.7976931348623157E+308)
                }
                ieee754.write(buf, value, offset, littleEndian, 52, 8)
                return offset + 8
            }

            Buffer.prototype.writeDoubleLE = function writeDoubleLE(value, offset, noAssert) {
                return writeDouble(this, value, offset, true, noAssert)
            }

            Buffer.prototype.writeDoubleBE = function writeDoubleBE(value, offset, noAssert) {
                return writeDouble(this, value, offset, false, noAssert)
            }

            // copy(targetBuffer, targetStart=0, sourceStart=0, sourceEnd=buffer.length)
            Buffer.prototype.copy = function copy(target, targetStart, start, end) {
                if (!start) start = 0
                if (!end && end !== 0) end = this.length
                if (targetStart >= target.length) targetStart = target.length
                if (!targetStart) targetStart = 0
                if (end > 0 && end < start) end = start

                // Copy 0 bytes; we're done
                if (end === start) return 0
                if (target.length === 0 || this.length === 0) return 0

                // Fatal error conditions
                if (targetStart < 0) {
                    throw new RangeError('targetStart out of bounds')
                }
                if (start < 0 || start >= this.length) throw new RangeError('sourceStart out of bounds')
                if (end < 0) throw new RangeError('sourceEnd out of bounds')

                // Are we oob?
                if (end > this.length) end = this.length
                if (target.length - targetStart < end - start) {
                    end = target.length - targetStart + start
                }

                var len = end - start
                var i

                if (this === target && start < targetStart && targetStart < end) {
                    // descending copy from end
                    for (i = len - 1; i >= 0; --i) {
                        target[i + targetStart] = this[i + start]
                    }
                } else if (len < 1000 || !Buffer.TYPED_ARRAY_SUPPORT) {
                    // ascending copy from start
                    for (i = 0; i < len; ++i) {
                        target[i + targetStart] = this[i + start]
                    }
                } else {
                    Uint8Array.prototype.set.call(
                        target,
                        this.subarray(start, start + len),
                        targetStart
                    )
                }

                return len
            }

            // Usage:
            //    buffer.fill(number[, offset[, end]])
            //    buffer.fill(buffer[, offset[, end]])
            //    buffer.fill(string[, offset[, end]][, encoding])
            Buffer.prototype.fill = function fill(val, start, end, encoding) {
                // Handle string cases:
                if (typeof val === 'string') {
                    if (typeof start === 'string') {
                        encoding = start
                        start = 0
                        end = this.length
                    } else if (typeof end === 'string') {
                        encoding = end
                        end = this.length
                    }
                    if (val.length === 1) {
                        var code = val.charCodeAt(0)
                        if (code < 256) {
                            val = code
                        }
                    }
                    if (encoding !== undefined && typeof encoding !== 'string') {
                        throw new TypeError('encoding must be a string')
                    }
                    if (typeof encoding === 'string' && !Buffer.isEncoding(encoding)) {
                        throw new TypeError('Unknown encoding: ' + encoding)
                    }
                } else if (typeof val === 'number') {
                    val = val & 255
                }

                // Invalid ranges are not set to a default, so can range check early.
                if (start < 0 || this.length < start || this.length < end) {
                    throw new RangeError('Out of range index')
                }

                if (end <= start) {
                    return this
                }

                start = start >>> 0
                end = end === undefined ? this.length : end >>> 0

                if (!val) val = 0

                var i
                if (typeof val === 'number') {
                    for (i = start; i < end; ++i) {
                        this[i] = val
                    }
                } else {
                    var bytes = Buffer.isBuffer(val)
                    ? val
                    : utf8ToBytes(new Buffer(val, encoding).toString())
                    var len = bytes.length
                    for (i = 0; i < end - start; ++i) {
                        this[i + start] = bytes[i % len]
                    }
                }

                return this
            }

            // HELPER FUNCTIONS
            // ================

            var INVALID_BASE64_RE = /[^+\/0-9A-Za-z-_]/g

            function base64clean(str) {
                // Node strips out invalid characters like \n and \t from the string, base64-js does not
                str = stringtrim(str).replace(INVALID_BASE64_RE, '')
                // Node converts strings with length < 2 to ''
                if (str.length < 2) return ''
                // Node allows for non-padded base64 strings (missing trailing ===), base64-js does not
                while (str.length % 4 !== 0) {
                    str = str + '='
                }
                return str
            }

            function stringtrim(str) {
                if (str.trim) return str.trim()
                return str.replace(/^\s+|\s+$/g, '')
            }

            function toHex(n) {
                if (n < 16) return '0' + n.toString(16)
                return n.toString(16)
            }

            function utf8ToBytes(string, units) {
                units = units || Infinity
                var codePoint
                var length = string.length
                var leadSurrogate = null
                var bytes = []

                for (var i = 0; i < length; ++i) {
                    codePoint = string.charCodeAt(i)

                    // is surrogate component
                    if (codePoint > 0xD7FF && codePoint < 0xE000) {
                        // last char was a lead
                        if (!leadSurrogate) {
                            // no lead yet
                            if (codePoint > 0xDBFF) {
                                // unexpected trail
                                if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
                                continue
                            } else if (i + 1 === length) {
                                // unpaired lead
                                if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
                                continue
                            }

                            // valid lead
                            leadSurrogate = codePoint

                            continue
                        }

                        // 2 leads in a row
                        if (codePoint < 0xDC00) {
                            if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
                            leadSurrogate = codePoint
                            continue
                        }

                        // valid surrogate pair
                        codePoint = (leadSurrogate - 0xD800 << 10 | codePoint - 0xDC00) + 0x10000
                    } else if (leadSurrogate) {
                        // valid bmp char, but last char was a lead
                        if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
                    }

                    leadSurrogate = null

                    // encode utf8
                    if (codePoint < 0x80) {
                        if ((units -= 1) < 0) break
                        bytes.push(codePoint)
                    } else if (codePoint < 0x800) {
                        if ((units -= 2) < 0) break
                        bytes.push(
                            codePoint >> 0x6 | 0xC0,
                            codePoint & 0x3F | 0x80
                        )
                    } else if (codePoint < 0x10000) {
                        if ((units -= 3) < 0) break
                        bytes.push(
                            codePoint >> 0xC | 0xE0,
                            codePoint >> 0x6 & 0x3F | 0x80,
                            codePoint & 0x3F | 0x80
                        )
                    } else if (codePoint < 0x110000) {
                        if ((units -= 4) < 0) break
                        bytes.push(
                            codePoint >> 0x12 | 0xF0,
                            codePoint >> 0xC & 0x3F | 0x80,
                            codePoint >> 0x6 & 0x3F | 0x80,
                            codePoint & 0x3F | 0x80
                        )
                    } else {
                        throw new Error('Invalid code point')
                    }
                }

                return bytes
            }

            function asciiToBytes(str) {
                var byteArray = []
                for (var i = 0; i < str.length; ++i) {
                    // Node's code seems to be doing this and not & 0x7F..
                    byteArray.push(str.charCodeAt(i) & 0xFF)
                }
                return byteArray
            }

            function utf16leToBytes(str, units) {
                var c, hi, lo
                var byteArray = []
                for (var i = 0; i < str.length; ++i) {
                    if ((units -= 2) < 0) break

                    c = str.charCodeAt(i)
                    hi = c >> 8
                    lo = c % 256
                    byteArray.push(lo)
                    byteArray.push(hi)
                }

                return byteArray
            }

            function base64ToBytes(str) {
                return base64.toByteArray(base64clean(str))
            }

            function blitBuffer(src, dst, offset, length) {
                for (var i = 0; i < length; ++i) {
                    if ((i + offset >= dst.length) || (i >= src.length)) break
                    dst[i + offset] = src[i]
                }
                return i
            }

            function isnan(val) {
                return val !== val // eslint-disable-line no-self-compare
            }

            /* WEBPACK VAR INJECTION */
        }.call(this, __webpack_require__(/*! ./../webpack/buildin/global.js */ "./node_modules/webpack/buildin/global.js")))

        /***/
    }),

    /***/ "./node_modules/buffer/node_modules/isarray/index.js":
    /*!***********************************************************!*\
  !*** ./node_modules/buffer/node_modules/isarray/index.js ***!
  \***********************************************************/
    /*! no static exports found */
    /***/ (function (module, exports) {

        var toString = {}.toString;

        module.exports = Array.isArray || function (arr) {
            return toString.call(arr) == '[object Array]';
        };


        /***/
    }),

    /***/ "./node_modules/charenc/charenc.js":
    /*!*****************************************!*\
  !*** ./node_modules/charenc/charenc.js ***!
  \*****************************************/
    /*! no static exports found */
    /***/ (function (module, exports) {

        var charenc = {
            // UTF-8 encoding
            utf8: {
                // Convert a string to a byte array
                stringToBytes: function (str) {
                    return charenc.bin.stringToBytes(unescape(encodeURIComponent(str)));
                },

                // Convert a byte array to a string
                bytesToString: function (bytes) {
                    return decodeURIComponent(escape(charenc.bin.bytesToString(bytes)));
                }
            },

            // Binary encoding
            bin: {
                // Convert a string to a byte array
                stringToBytes: function (str) {
                    for (var bytes = [], i = 0; i < str.length; i++)
                        bytes.push(str.charCodeAt(i) & 0xFF);
                    return bytes;
                },

                // Convert a byte array to a string
                bytesToString: function (bytes) {
                    for (var str = [], i = 0; i < bytes.length; i++)
                        str.push(String.fromCharCode(bytes[i]));
                    return str.join('');
                }
            }
        };

        module.exports = charenc;


        /***/
    }),

    /***/ "./node_modules/crypt/crypt.js":
    /*!*************************************!*\
  !*** ./node_modules/crypt/crypt.js ***!
  \*************************************/
    /*! no static exports found */
    /***/ (function (module, exports) {

        (function () {
            var base64map
            = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/',

                crypt = {
                    // Bit-wise rotation left
                    rotl: function (n, b) {
                        return (n << b) | (n >>> (32 - b));
                    },

                    // Bit-wise rotation right
                    rotr: function (n, b) {
                        return (n << (32 - b)) | (n >>> b);
                    },

                    // Swap big-endian to little-endian and vice versa
                    endian: function (n) {
                        // If number given, swap endian
                        if (n.constructor == Number) {
                            return crypt.rotl(n, 8) & 0x00FF00FF | crypt.rotl(n, 24) & 0xFF00FF00;
                        }

                        // Else, assume array and swap all items
                        for (var i = 0; i < n.length; i++)
                            n[i] = crypt.endian(n[i]);
                        return n;
                    },

                    // Generate an array of any length of random bytes
                    randomBytes: function (n) {
                        for (var bytes = []; n > 0; n--)
                            bytes.push(Math.floor(Math.random() * 256));
                        return bytes;
                    },

                    // Convert a byte array to big-endian 32-bit words
                    bytesToWords: function (bytes) {
                        for (var words = [], i = 0, b = 0; i < bytes.length; i++, b += 8)
                            words[b >>> 5] |= bytes[i] << (24 - b % 32);
                        return words;
                    },

                    // Convert big-endian 32-bit words to a byte array
                    wordsToBytes: function (words) {
                        for (var bytes = [], b = 0; b < words.length * 32; b += 8)
                            bytes.push((words[b >>> 5] >>> (24 - b % 32)) & 0xFF);
                        return bytes;
                    },

                    // Convert a byte array to a hex string
                    bytesToHex: function (bytes) {
                        for (var hex = [], i = 0; i < bytes.length; i++) {
                            hex.push((bytes[i] >>> 4).toString(16));
                            hex.push((bytes[i] & 0xF).toString(16));
                        }
                        return hex.join('');
                    },

                    // Convert a hex string to a byte array
                    hexToBytes: function (hex) {
                        for (var bytes = [], c = 0; c < hex.length; c += 2)
                            bytes.push(parseInt(hex.substr(c, 2), 16));
                        return bytes;
                    },

                    // Convert a byte array to a base-64 string
                    bytesToBase64: function (bytes) {
                        for (var base64 = [], i = 0; i < bytes.length; i += 3) {
                            var triplet = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
                            for (var j = 0; j < 4; j++)
                                if (i * 8 + j * 6 <= bytes.length * 8)
                                    base64.push(base64map.charAt((triplet >>> 6 * (3 - j)) & 0x3F));
                                else
                                    base64.push('=');
                        }
                        return base64.join('');
                    },

                    // Convert a base-64 string to a byte array
                    base64ToBytes: function (base64) {
                        // Remove non-base-64 characters
                        base64 = base64.replace(/[^A-Z0-9+\/]/ig, '');

                        for (var bytes = [], i = 0, imod4 = 0; i < base64.length;
                             imod4 = ++i % 4) {
                            if (imod4 == 0) continue;
                            bytes.push(((base64map.indexOf(base64.charAt(i - 1))
                                         & (Math.pow(2, -2 * imod4 + 8) - 1)) << (imod4 * 2))
                                       | (base64map.indexOf(base64.charAt(i)) >>> (6 - imod4 * 2)));
                        }
                        return bytes;
                    }
                };

            module.exports = crypt;
        })();


        /***/
    }),

    /***/ "./node_modules/event-lite/event-lite.js":
    /*!***********************************************!*\
  !*** ./node_modules/event-lite/event-lite.js ***!
  \***********************************************/
    /*! no static exports found */
    /***/ (function (module, exports, __webpack_require__) {

        /**
     * event-lite.js - Light-weight EventEmitter (less than 1KB when gzipped)
     *
     * @copyright Yusuke Kawasaki
     * @license MIT
     * @constructor
     * @see https://github.com/kawanet/event-lite
     * @see http://kawanet.github.io/event-lite/EventLite.html
     * @example
     * var EventLite = require("event-lite");
     *
     * function MyClass() {...}             // your class
     *
     * EventLite.mixin(MyClass.prototype);  // import event methods
     *
     * var obj = new MyClass();
     * obj.on("foo", function() {...});     // add event listener
     * obj.once("bar", function() {...});   // add one-time event listener
     * obj.emit("foo");                     // dispatch event
     * obj.emit("bar");                     // dispatch another event
     * obj.off("foo");                      // remove event listener
     */

        function EventLite() {
            if (!(this instanceof EventLite)) return new EventLite();
        }

        (function (EventLite) {
            // export the class for node.js
            if (true) module.exports = EventLite;

            // property name to hold listeners
            var LISTENERS = "listeners";

            // methods to export
            var methods = {
                on: on,
                once: once,
                off: off,
                emit: emit
            };

            // mixin to self
            mixin(EventLite.prototype);

            // export mixin function
            EventLite.mixin = mixin;

            /**
       * Import on(), once(), off() and emit() methods into target object.
       *
       * @function EventLite.mixin
       * @param target {Prototype}
       */

            function mixin(target) {
                for (var key in methods) {
                    target[key] = methods[key];
                }
                return target;
            }

            /**
       * Add an event listener.
       *
       * @function EventLite.prototype.on
       * @param type {string}
       * @param func {Function}
       * @returns {EventLite} Self for method chaining
       */

            function on(type, func) {
                getListeners(this, type).push(func);
                return this;
            }

            /**
       * Add one-time event listener.
       *
       * @function EventLite.prototype.once
       * @param type {string}
       * @param func {Function}
       * @returns {EventLite} Self for method chaining
       */

            function once(type, func) {
                var that = this;
                wrap.originalListener = func;
                getListeners(that, type).push(wrap);
                return that;

                function wrap() {
                    off.call(that, type, wrap);
                    func.apply(this, arguments);
                }
            }

            /**
       * Remove an event listener.
       *
       * @function EventLite.prototype.off
       * @param [type] {string}
       * @param [func] {Function}
       * @returns {EventLite} Self for method chaining
       */

            function off(type, func) {
                var that = this;
                var listners;
                if (!arguments.length) {
                    delete that[LISTENERS];
                } else if (!func) {
                    listners = that[LISTENERS];
                    if (listners) {
                        delete listners[type];
                        if (!Object.keys(listners).length) return off.call(that);
                    }
                } else {
                    listners = getListeners(that, type, true);
                    if (listners) {
                        listners = listners.filter(ne);
                        if (!listners.length) return off.call(that, type);
                        that[LISTENERS][type] = listners;
                    }
                }
                return that;

                function ne(test) {
                    return test !== func && test.originalListener !== func;
                }
            }

            /**
       * Dispatch (trigger) an event.
       *
       * @function EventLite.prototype.emit
       * @param type {string}
       * @param [value] {*}
       * @returns {boolean} True when a listener received the event
       */

            function emit(type, value) {
                var that = this;
                var listeners = getListeners(that, type, true);
                if (!listeners) return false;
                var arglen = arguments.length;
                if (arglen === 1) {
                    listeners.forEach(zeroarg);
                } else if (arglen === 2) {
                    listeners.forEach(onearg);
                } else {
                    var args = Array.prototype.slice.call(arguments, 1);
                    listeners.forEach(moreargs);
                }
                return !!listeners.length;

                function zeroarg(func) {
                    func.call(that);
                }

                function onearg(func) {
                    func.call(that, value);
                }

                function moreargs(func) {
                    func.apply(that, args);
                }
            }

            /**
       * @ignore
       */

            function getListeners(that, type, readonly) {
                if (readonly && !that[LISTENERS]) return;
                var listeners = that[LISTENERS] || (that[LISTENERS] = {});
                return listeners[type] || (listeners[type] = []);
            }

        })(EventLite);


        /***/
    }),

    /***/ "./node_modules/ieee754/index.js":
    /*!***************************************!*\
  !*** ./node_modules/ieee754/index.js ***!
  \***************************************/
    /*! no static exports found */
    /***/ (function (module, exports) {

        exports.read = function (buffer, offset, isLE, mLen, nBytes) {
            var e, m
            var eLen = (nBytes * 8) - mLen - 1
            var eMax = (1 << eLen) - 1
            var eBias = eMax >> 1
            var nBits = -7
            var i = isLE ? (nBytes - 1) : 0
            var d = isLE ? -1 : 1
            var s = buffer[offset + i]

            i += d

            e = s & ((1 << (-nBits)) - 1)
            s >>= (-nBits)
            nBits += eLen
            for (; nBits > 0; e = (e * 256) + buffer[offset + i], i += d, nBits -= 8) { }

            m = e & ((1 << (-nBits)) - 1)
            e >>= (-nBits)
            nBits += mLen
            for (; nBits > 0; m = (m * 256) + buffer[offset + i], i += d, nBits -= 8) { }

            if (e === 0) {
                e = 1 - eBias
            } else if (e === eMax) {
                return m ? NaN : ((s ? -1 : 1) * Infinity)
            } else {
                m = m + Math.pow(2, mLen)
                e = e - eBias
            }
            return (s ? -1 : 1) * m * Math.pow(2, e - mLen)
        }

        exports.write = function (buffer, value, offset, isLE, mLen, nBytes) {
            var e, m, c
            var eLen = (nBytes * 8) - mLen - 1
            var eMax = (1 << eLen) - 1
            var eBias = eMax >> 1
            var rt = (mLen === 23 ? Math.pow(2, -24) - Math.pow(2, -77) : 0)
            var i = isLE ? 0 : (nBytes - 1)
            var d = isLE ? 1 : -1
            var s = value < 0 || (value === 0 && 1 / value < 0) ? 1 : 0

            value = Math.abs(value)

            if (isNaN(value) || value === Infinity) {
                m = isNaN(value) ? 1 : 0
                e = eMax
            } else {
                e = Math.floor(Math.log(value) / Math.LN2)
                if (value * (c = Math.pow(2, -e)) < 1) {
                    e--
                    c *= 2
                }
                if (e + eBias >= 1) {
                    value += rt / c
                } else {
                    value += rt * Math.pow(2, 1 - eBias)
                }
                if (value * c >= 2) {
                    e++
                    c /= 2
                }

                if (e + eBias >= eMax) {
                    m = 0
                    e = eMax
                } else if (e + eBias >= 1) {
                    m = ((value * c) - 1) * Math.pow(2, mLen)
                    e = e + eBias
                } else {
                    m = value * Math.pow(2, eBias - 1) * Math.pow(2, mLen)
                    e = 0
                }
            }

            for (; mLen >= 8; buffer[offset + i] = m & 0xff, i += d, m /= 256, mLen -= 8) { }

            e = (e << mLen) | m
            eLen += mLen
            for (; eLen > 0; buffer[offset + i] = e & 0xff, i += d, e /= 256, eLen -= 8) { }

            buffer[offset + i - d] |= s * 128
        }


        /***/
    }),

    /***/ "./node_modules/int64-buffer/int64-buffer.js":
    /*!***************************************************!*\
  !*** ./node_modules/int64-buffer/int64-buffer.js ***!
  \***************************************************/
    /*! no static exports found */
    /***/ (function (module, exports, __webpack_require__) {

        /* WEBPACK VAR INJECTION */(function (Buffer) {// int64-buffer.js

            /*jshint -W018 */ // Confusing use of '!'.
            /*jshint -W030 */ // Expected an assignment or function call and instead saw an expression.
            /*jshint -W093 */ // Did you mean to return a conditional instead of an assignment?

            var Uint64BE, Int64BE, Uint64LE, Int64LE;

            !function (exports) {
                // constants

                var UNDEFINED = "undefined";
                var BUFFER = (UNDEFINED !== typeof Buffer) && Buffer;
                var UINT8ARRAY = (UNDEFINED !== typeof Uint8Array) && Uint8Array;
                var ARRAYBUFFER = (UNDEFINED !== typeof ArrayBuffer) && ArrayBuffer;
                var ZERO = [0, 0, 0, 0, 0, 0, 0, 0];
                var isArray = Array.isArray || _isArray;
                var BIT32 = 4294967296;
                var BIT24 = 16777216;

                // storage class

                var storage; // Array;

                // generate classes

                Uint64BE = factory("Uint64BE", true, true);
                Int64BE = factory("Int64BE", true, false);
                Uint64LE = factory("Uint64LE", false, true);
                Int64LE = factory("Int64LE", false, false);

                // class factory

                function factory(name, bigendian, unsigned) {
                    var posH = bigendian ? 0 : 4;
                    var posL = bigendian ? 4 : 0;
                    var pos0 = bigendian ? 0 : 3;
                    var pos1 = bigendian ? 1 : 2;
                    var pos2 = bigendian ? 2 : 1;
                    var pos3 = bigendian ? 3 : 0;
                    var fromPositive = bigendian ? fromPositiveBE : fromPositiveLE;
                    var fromNegative = bigendian ? fromNegativeBE : fromNegativeLE;
                    var proto = Int64.prototype;
                    var isName = "is" + name;
                    var _isInt64 = "_" + isName;

                    // properties
                    proto.buffer = void 0;
                    proto.offset = 0;
                    proto[_isInt64] = true;

                    // methods
                    proto.toNumber = toNumber;
                    proto.toString = toString;
                    proto.toJSON = toNumber;
                    proto.toArray = toArray;

                    // add .toBuffer() method only when Buffer available
                    if (BUFFER) proto.toBuffer = toBuffer;

                    // add .toArrayBuffer() method only when Uint8Array available
                    if (UINT8ARRAY) proto.toArrayBuffer = toArrayBuffer;

                    // isUint64BE, isInt64BE
                    Int64[isName] = isInt64;

                    // CommonJS
                    exports[name] = Int64;

                    return Int64;

                    // constructor
                    function Int64(buffer, offset, value, raddix) {
                        if (!(this instanceof Int64)) return new Int64(buffer, offset, value, raddix);
                        return init(this, buffer, offset, value, raddix);
                    }

                    // isUint64BE, isInt64BE
                    function isInt64(b) {
                        return !!(b && b[_isInt64]);
                    }

                    // initializer
                    function init(that, buffer, offset, value, raddix) {
                        if (UINT8ARRAY && ARRAYBUFFER) {
                            if (buffer instanceof ARRAYBUFFER) buffer = new UINT8ARRAY(buffer);
                            if (value instanceof ARRAYBUFFER) value = new UINT8ARRAY(value);
                        }

                        // Int64BE() style
                        if (!buffer && !offset && !value && !storage) {
                            // shortcut to initialize with zero
                            that.buffer = newArray(ZERO, 0);
                            return;
                        }

                        // Int64BE(value, raddix) style
                        if (!isValidBuffer(buffer, offset)) {
                            var _storage = storage || Array;
                            raddix = offset;
                            value = buffer;
                            offset = 0;
                            buffer = new _storage(8);
                        }

                        that.buffer = buffer;
                        that.offset = offset |= 0;

                        // Int64BE(buffer, offset) style
                        if (UNDEFINED === typeof value) return;

                        // Int64BE(buffer, offset, value, raddix) style
                        if ("string" === typeof value) {
                            fromString(buffer, offset, value, raddix || 10);
                        } else if (isValidBuffer(value, raddix)) {
                            fromArray(buffer, offset, value, raddix);
                        } else if ("number" === typeof raddix) {
                            writeInt32(buffer, offset + posH, value); // high
                            writeInt32(buffer, offset + posL, raddix); // low
                        } else if (value > 0) {
                            fromPositive(buffer, offset, value); // positive
                        } else if (value < 0) {
                            fromNegative(buffer, offset, value); // negative
                        } else {
                            fromArray(buffer, offset, ZERO, 0); // zero, NaN and others
                        }
                    }

                    function fromString(buffer, offset, str, raddix) {
                        var pos = 0;
                        var len = str.length;
                        var high = 0;
                        var low = 0;
                        if (str[0] === "-") pos++;
                        var sign = pos;
                        while (pos < len) {
                            var chr = parseInt(str[pos++], raddix);
                            if (!(chr >= 0)) break; // NaN
                            low = low * raddix + chr;
                            high = high * raddix + Math.floor(low / BIT32);
                            low %= BIT32;
                        }
                        if (sign) {
                            high = ~high;
                            if (low) {
                                low = BIT32 - low;
                            } else {
                                high++;
                            }
                        }
                        writeInt32(buffer, offset + posH, high);
                        writeInt32(buffer, offset + posL, low);
                    }

                    function toNumber() {
                        var buffer = this.buffer;
                        var offset = this.offset;
                        var high = readInt32(buffer, offset + posH);
                        var low = readInt32(buffer, offset + posL);
                        if (!unsigned) high |= 0; // a trick to get signed
                        return high ? (high * BIT32 + low) : low;
                    }

                    function toString(radix) {
                        var buffer = this.buffer;
                        var offset = this.offset;
                        var high = readInt32(buffer, offset + posH);
                        var low = readInt32(buffer, offset + posL);
                        var str = "";
                        var sign = !unsigned && (high & 0x80000000);
                        if (sign) {
                            high = ~high;
                            low = BIT32 - low;
                        }
                        radix = radix || 10;
                        while (1) {
                            var mod = (high % radix) * BIT32 + low;
                            high = Math.floor(high / radix);
                            low = Math.floor(mod / radix);
                            str = (mod % radix).toString(radix) + str;
                            if (!high && !low) break;
                        }
                        if (sign) {
                            str = "-" + str;
                        }
                        return str;
                    }

                    function writeInt32(buffer, offset, value) {
                        buffer[offset + pos3] = value & 255;
                        value = value >> 8;
                        buffer[offset + pos2] = value & 255;
                        value = value >> 8;
                        buffer[offset + pos1] = value & 255;
                        value = value >> 8;
                        buffer[offset + pos0] = value & 255;
                    }

                    function readInt32(buffer, offset) {
                        return (buffer[offset + pos0] * BIT24) +
                            (buffer[offset + pos1] << 16) +
                            (buffer[offset + pos2] << 8) +
                            buffer[offset + pos3];
                    }
                }

                function toArray(raw) {
                    var buffer = this.buffer;
                    var offset = this.offset;
                    storage = null; // Array
                    if (raw !== false && offset === 0 && buffer.length === 8 && isArray(buffer)) return buffer;
                    return newArray(buffer, offset);
                }

                function toBuffer(raw) {
                    var buffer = this.buffer;
                    var offset = this.offset;
                    storage = BUFFER;
                    if (raw !== false && offset === 0 && buffer.length === 8 && Buffer.isBuffer(buffer)) return buffer;
                    var dest = new BUFFER(8);
                    fromArray(dest, 0, buffer, offset);
                    return dest;
                }

                function toArrayBuffer(raw) {
                    var buffer = this.buffer;
                    var offset = this.offset;
                    var arrbuf = buffer.buffer;
                    storage = UINT8ARRAY;
                    if (raw !== false && offset === 0 && (arrbuf instanceof ARRAYBUFFER) && arrbuf.byteLength === 8) return arrbuf;
                    var dest = new UINT8ARRAY(8);
                    fromArray(dest, 0, buffer, offset);
                    return dest.buffer;
                }

                function isValidBuffer(buffer, offset) {
                    var len = buffer && buffer.length;
                    offset |= 0;
                    return len && (offset + 8 <= len) && ("string" !== typeof buffer[offset]);
                }

                function fromArray(destbuf, destoff, srcbuf, srcoff) {
                    destoff |= 0;
                    srcoff |= 0;
                    for (var i = 0; i < 8; i++) {
                        destbuf[destoff++] = srcbuf[srcoff++] & 255;
                    }
                }

                function newArray(buffer, offset) {
                    return Array.prototype.slice.call(buffer, offset, offset + 8);
                }

                function fromPositiveBE(buffer, offset, value) {
                    var pos = offset + 8;
                    while (pos > offset) {
                        buffer[--pos] = value & 255;
                        value /= 256;
                    }
                }

                function fromNegativeBE(buffer, offset, value) {
                    var pos = offset + 8;
                    value++;
                    while (pos > offset) {
                        buffer[--pos] = ((-value) & 255) ^ 255;
                        value /= 256;
                    }
                }

                function fromPositiveLE(buffer, offset, value) {
                    var end = offset + 8;
                    while (offset < end) {
                        buffer[offset++] = value & 255;
                        value /= 256;
                    }
                }

                function fromNegativeLE(buffer, offset, value) {
                    var end = offset + 8;
                    value++;
                    while (offset < end) {
                        buffer[offset++] = ((-value) & 255) ^ 255;
                        value /= 256;
                    }
                }

                // https://github.com/retrofox/is-array
                function _isArray(val) {
                    return !!val && "[object Array]" == Object.prototype.toString.call(val);
                }

            }(true && typeof exports.nodeName !== 'string' ? exports : (this || {}));

            /* WEBPACK VAR INJECTION */
        }.call(this, __webpack_require__(/*! ./../buffer/index.js */ "./node_modules/buffer/index.js").Buffer))

        /***/
    }),

    /***/ "./node_modules/is-buffer/index.js":
    /*!*****************************************!*\
  !*** ./node_modules/is-buffer/index.js ***!
  \*****************************************/
    /*! no static exports found */
    /***/ (function (module, exports) {

        /*!
     * Determine if an object is a Buffer
     *
     * @author   Feross Aboukhadijeh <https://feross.org>
     * @license  MIT
     */

        // The _isBuffer check is for Safari 5-7 support, because it's missing
        // Object.prototype.constructor. Remove this eventually
        module.exports = function (obj) {
            return obj != null && (isBuffer(obj) || isSlowBuffer(obj) || !!obj._isBuffer)
        }

        function isBuffer(obj) {
            return !!obj.constructor && typeof obj.constructor.isBuffer === 'function' && obj.constructor.isBuffer(obj)
        }

        // For Node v0.10 support. Remove this eventually.
        function isSlowBuffer(obj) {
            return typeof obj.readFloatLE === 'function' && typeof obj.slice === 'function' && isBuffer(obj.slice(0, 0))
        }


        /***/
    }),

    /***/ "./node_modules/md5/md5.js":
    /*!*********************************!*\
  !*** ./node_modules/md5/md5.js ***!
  \*********************************/
    /*! no static exports found */
    /***/ (function (module, exports, __webpack_require__) {

        (function () {
            var crypt = __webpack_require__(/*! crypt */ "./node_modules/crypt/crypt.js"),
                utf8 = __webpack_require__(/*! charenc */ "./node_modules/charenc/charenc.js").utf8,
                isBuffer = __webpack_require__(/*! is-buffer */ "./node_modules/is-buffer/index.js"),
                bin = __webpack_require__(/*! charenc */ "./node_modules/charenc/charenc.js").bin,

                // The core
                md5 = function (message, options) {
                    // Convert to byte array
                    if (message.constructor == String)
                        if (options && options.encoding === 'binary')
                            message = bin.stringToBytes(message);
                        else
                            message = utf8.stringToBytes(message);
                    else if (isBuffer(message))
                        message = Array.prototype.slice.call(message, 0);
                    else if (!Array.isArray(message))
                        message = message.toString();
                    // else, assume byte array already

                    var m = crypt.bytesToWords(message),
                        l = message.length * 8,
                        a = 1732584193,
                        b = -271733879,
                        c = -1732584194,
                        d = 271733878;

                    // Swap endian
                    for (var i = 0; i < m.length; i++) {
                        m[i] = ((m[i] << 8) | (m[i] >>> 24)) & 0x00FF00FF |
                            ((m[i] << 24) | (m[i] >>> 8)) & 0xFF00FF00;
                    }

                    // Padding
                    m[l >>> 5] |= 0x80 << (l % 32);
                    m[(((l + 64) >>> 9) << 4) + 14] = l;

                    // Method shortcuts
                    var FF = md5._ff,
                        GG = md5._gg,
                        HH = md5._hh,
                        II = md5._ii;

                    for (var i = 0; i < m.length; i += 16) {

                        var aa = a,
                            bb = b,
                            cc = c,
                            dd = d;

                        a = FF(a, b, c, d, m[i + 0], 7, -680876936);
                        d = FF(d, a, b, c, m[i + 1], 12, -389564586);
                        c = FF(c, d, a, b, m[i + 2], 17, 606105819);
                        b = FF(b, c, d, a, m[i + 3], 22, -1044525330);
                        a = FF(a, b, c, d, m[i + 4], 7, -176418897);
                        d = FF(d, a, b, c, m[i + 5], 12, 1200080426);
                        c = FF(c, d, a, b, m[i + 6], 17, -1473231341);
                        b = FF(b, c, d, a, m[i + 7], 22, -45705983);
                        a = FF(a, b, c, d, m[i + 8], 7, 1770035416);
                        d = FF(d, a, b, c, m[i + 9], 12, -1958414417);
                        c = FF(c, d, a, b, m[i + 10], 17, -42063);
                        b = FF(b, c, d, a, m[i + 11], 22, -1990404162);
                        a = FF(a, b, c, d, m[i + 12], 7, 1804603682);
                        d = FF(d, a, b, c, m[i + 13], 12, -40341101);
                        c = FF(c, d, a, b, m[i + 14], 17, -1502002290);
                        b = FF(b, c, d, a, m[i + 15], 22, 1236535329);

                        a = GG(a, b, c, d, m[i + 1], 5, -165796510);
                        d = GG(d, a, b, c, m[i + 6], 9, -1069501632);
                        c = GG(c, d, a, b, m[i + 11], 14, 643717713);
                        b = GG(b, c, d, a, m[i + 0], 20, -373897302);
                        a = GG(a, b, c, d, m[i + 5], 5, -701558691);
                        d = GG(d, a, b, c, m[i + 10], 9, 38016083);
                        c = GG(c, d, a, b, m[i + 15], 14, -660478335);
                        b = GG(b, c, d, a, m[i + 4], 20, -405537848);
                        a = GG(a, b, c, d, m[i + 9], 5, 568446438);
                        d = GG(d, a, b, c, m[i + 14], 9, -1019803690);
                        c = GG(c, d, a, b, m[i + 3], 14, -187363961);
                        b = GG(b, c, d, a, m[i + 8], 20, 1163531501);
                        a = GG(a, b, c, d, m[i + 13], 5, -1444681467);
                        d = GG(d, a, b, c, m[i + 2], 9, -51403784);
                        c = GG(c, d, a, b, m[i + 7], 14, 1735328473);
                        b = GG(b, c, d, a, m[i + 12], 20, -1926607734);

                        a = HH(a, b, c, d, m[i + 5], 4, -378558);
                        d = HH(d, a, b, c, m[i + 8], 11, -2022574463);
                        c = HH(c, d, a, b, m[i + 11], 16, 1839030562);
                        b = HH(b, c, d, a, m[i + 14], 23, -35309556);
                        a = HH(a, b, c, d, m[i + 1], 4, -1530992060);
                        d = HH(d, a, b, c, m[i + 4], 11, 1272893353);
                        c = HH(c, d, a, b, m[i + 7], 16, -155497632);
                        b = HH(b, c, d, a, m[i + 10], 23, -1094730640);
                        a = HH(a, b, c, d, m[i + 13], 4, 681279174);
                        d = HH(d, a, b, c, m[i + 0], 11, -358537222);
                        c = HH(c, d, a, b, m[i + 3], 16, -722521979);
                        b = HH(b, c, d, a, m[i + 6], 23, 76029189);
                        a = HH(a, b, c, d, m[i + 9], 4, -640364487);
                        d = HH(d, a, b, c, m[i + 12], 11, -421815835);
                        c = HH(c, d, a, b, m[i + 15], 16, 530742520);
                        b = HH(b, c, d, a, m[i + 2], 23, -995338651);

                        a = II(a, b, c, d, m[i + 0], 6, -198630844);
                        d = II(d, a, b, c, m[i + 7], 10, 1126891415);
                        c = II(c, d, a, b, m[i + 14], 15, -1416354905);
                        b = II(b, c, d, a, m[i + 5], 21, -57434055);
                        a = II(a, b, c, d, m[i + 12], 6, 1700485571);
                        d = II(d, a, b, c, m[i + 3], 10, -1894986606);
                        c = II(c, d, a, b, m[i + 10], 15, -1051523);
                        b = II(b, c, d, a, m[i + 1], 21, -2054922799);
                        a = II(a, b, c, d, m[i + 8], 6, 1873313359);
                        d = II(d, a, b, c, m[i + 15], 10, -30611744);
                        c = II(c, d, a, b, m[i + 6], 15, -1560198380);
                        b = II(b, c, d, a, m[i + 13], 21, 1309151649);
                        a = II(a, b, c, d, m[i + 4], 6, -145523070);
                        d = II(d, a, b, c, m[i + 11], 10, -1120210379);
                        c = II(c, d, a, b, m[i + 2], 15, 718787259);
                        b = II(b, c, d, a, m[i + 9], 21, -343485551);

                        a = (a + aa) >>> 0;
                        b = (b + bb) >>> 0;
                        c = (c + cc) >>> 0;
                        d = (d + dd) >>> 0;
                    }

                    return crypt.endian([a, b, c, d]);
                };

            // Auxiliary functions
            md5._ff = function (a, b, c, d, x, s, t) {
                var n = a + (b & c | ~b & d) + (x >>> 0) + t;
                return ((n << s) | (n >>> (32 - s))) + b;
            };
            md5._gg = function (a, b, c, d, x, s, t) {
                var n = a + (b & d | c & ~d) + (x >>> 0) + t;
                return ((n << s) | (n >>> (32 - s))) + b;
            };
            md5._hh = function (a, b, c, d, x, s, t) {
                var n = a + (b ^ c ^ d) + (x >>> 0) + t;
                return ((n << s) | (n >>> (32 - s))) + b;
            };
            md5._ii = function (a, b, c, d, x, s, t) {
                var n = a + (c ^ (b | ~d)) + (x >>> 0) + t;
                return ((n << s) | (n >>> (32 - s))) + b;
            };

            // Package private blocksize
            md5._blocksize = 16;
            md5._digestsize = 16;

            module.exports = function (message, options) {
                if (message === undefined || message === null)
                    throw new Error('Illegal argument ' + message);

                var digestbytes = crypt.wordsToBytes(md5(message, options));
                return options && options.asBytes ? digestbytes :
                options && options.asString ? bin.bytesToString(digestbytes) :
                crypt.bytesToHex(digestbytes);
            };

        })();


        /***/
    }),

    /***/ "./node_modules/msgpack-lite/lib/browser.js":
    /*!**************************************************!*\
  !*** ./node_modules/msgpack-lite/lib/browser.js ***!
  \**************************************************/
    /*! no static exports found */
    /***/ (function (module, exports, __webpack_require__) {

        // browser.js

        exports.encode = __webpack_require__(/*! ./encode */ "./node_modules/msgpack-lite/lib/encode.js").encode;
        exports.decode = __webpack_require__(/*! ./decode */ "./node_modules/msgpack-lite/lib/decode.js").decode;

        exports.Encoder = __webpack_require__(/*! ./encoder */ "./node_modules/msgpack-lite/lib/encoder.js").Encoder;
        exports.Decoder = __webpack_require__(/*! ./decoder */ "./node_modules/msgpack-lite/lib/decoder.js").Decoder;

        exports.createCodec = __webpack_require__(/*! ./ext */ "./node_modules/msgpack-lite/lib/ext.js").createCodec;
        exports.codec = __webpack_require__(/*! ./codec */ "./node_modules/msgpack-lite/lib/codec.js").codec;


        /***/
    }),

    /***/ "./node_modules/msgpack-lite/lib/buffer-global.js":
    /*!********************************************************!*\
  !*** ./node_modules/msgpack-lite/lib/buffer-global.js ***!
  \********************************************************/
    /*! no static exports found */
    /***/ (function (module, exports, __webpack_require__) {

        /* WEBPACK VAR INJECTION */(function (Buffer) {/* globals Buffer */

            module.exports =
                c(("undefined" !== typeof Buffer) && Buffer) ||
                c(this.Buffer) ||
                c(("undefined" !== typeof window) && window.Buffer) ||
                this.Buffer;

            function c(B) {
                return B && B.isBuffer && B;
            }
            /* WEBPACK VAR INJECTION */
        }.call(this, __webpack_require__(/*! ./../../buffer/index.js */ "./node_modules/buffer/index.js").Buffer))

        /***/
    }),

    /***/ "./node_modules/msgpack-lite/lib/buffer-lite.js":
    /*!******************************************************!*\
  !*** ./node_modules/msgpack-lite/lib/buffer-lite.js ***!
  \******************************************************/
    /*! no static exports found */
    /***/ (function (module, exports) {

        // buffer-lite.js

        var MAXBUFLEN = 8192;

        exports.copy = copy;
        exports.toString = toString;
        exports.write = write;

        /**
     * Buffer.prototype.write()
     *
     * @param string {String}
     * @param [offset] {Number}
     * @returns {Number}
     */

        function write(string, offset) {
            var buffer = this;
            var index = offset || (offset |= 0);
            var length = string.length;
            var chr = 0;
            var i = 0;
            while (i < length) {
                chr = string.charCodeAt(i++);

                if (chr < 128) {
                    buffer[index++] = chr;
                } else if (chr < 0x800) {
                    // 2 bytes
                    buffer[index++] = 0xC0 | (chr >>> 6);
                    buffer[index++] = 0x80 | (chr & 0x3F);
                } else if (chr < 0xD800 || chr > 0xDFFF) {
                    // 3 bytes
                    buffer[index++] = 0xE0 | (chr >>> 12);
                    buffer[index++] = 0x80 | ((chr >>> 6) & 0x3F);
                    buffer[index++] = 0x80 | (chr & 0x3F);
                } else {
                    // 4 bytes - surrogate pair
                    chr = (((chr - 0xD800) << 10) | (string.charCodeAt(i++) - 0xDC00)) + 0x10000;
                    buffer[index++] = 0xF0 | (chr >>> 18);
                    buffer[index++] = 0x80 | ((chr >>> 12) & 0x3F);
                    buffer[index++] = 0x80 | ((chr >>> 6) & 0x3F);
                    buffer[index++] = 0x80 | (chr & 0x3F);
                }
            }
            return index - offset;
        }

        /**
     * Buffer.prototype.toString()
     *
     * @param [encoding] {String} ignored
     * @param [start] {Number}
     * @param [end] {Number}
     * @returns {String}
     */

        function toString(encoding, start, end) {
            var buffer = this;
            var index = start | 0;
            if (!end) end = buffer.length;
            var string = '';
            var chr = 0;

            while (index < end) {
                chr = buffer[index++];
                if (chr < 128) {
                    string += String.fromCharCode(chr);
                    continue;
                }

                if ((chr & 0xE0) === 0xC0) {
                    // 2 bytes
                    chr = (chr & 0x1F) << 6 |
                        (buffer[index++] & 0x3F);

                } else if ((chr & 0xF0) === 0xE0) {
                    // 3 bytes
                    chr = (chr & 0x0F) << 12 |
                        (buffer[index++] & 0x3F) << 6 |
                        (buffer[index++] & 0x3F);

                } else if ((chr & 0xF8) === 0xF0) {
                    // 4 bytes
                    chr = (chr & 0x07) << 18 |
                        (buffer[index++] & 0x3F) << 12 |
                        (buffer[index++] & 0x3F) << 6 |
                        (buffer[index++] & 0x3F);
                }

                if (chr >= 0x010000) {
                    // A surrogate pair
                    chr -= 0x010000;

                    string += String.fromCharCode((chr >>> 10) + 0xD800, (chr & 0x3FF) + 0xDC00);
                } else {
                    string += String.fromCharCode(chr);
                }
            }

            return string;
        }

        /**
     * Buffer.prototype.copy()
     *
     * @param target {Buffer}
     * @param [targetStart] {Number}
     * @param [start] {Number}
     * @param [end] {Number}
     * @returns {number}
     */

        function copy(target, targetStart, start, end) {
            var i;
            if (!start) start = 0;
            if (!end && end !== 0) end = this.length;
            if (!targetStart) targetStart = 0;
            var len = end - start;

            if (target === this && start < targetStart && targetStart < end) {
                // descending
                for (i = len - 1; i >= 0; i--) {
                    target[i + targetStart] = this[i + start];
                }
            } else {
                // ascending
                for (i = 0; i < len; i++) {
                    target[i + targetStart] = this[i + start];
                }
            }

            return len;
        }


        /***/
    }),

    /***/ "./node_modules/msgpack-lite/lib/bufferish-array.js":
    /*!**********************************************************!*\
  !*** ./node_modules/msgpack-lite/lib/bufferish-array.js ***!
  \**********************************************************/
    /*! no static exports found */
    /***/ (function (module, exports, __webpack_require__) {

        // bufferish-array.js

        var Bufferish = __webpack_require__(/*! ./bufferish */ "./node_modules/msgpack-lite/lib/bufferish.js");

        var exports = module.exports = alloc(0);

        exports.alloc = alloc;
        exports.concat = Bufferish.concat;
        exports.from = from;

        /**
     * @param size {Number}
     * @returns {Buffer|Uint8Array|Array}
     */

        function alloc(size) {
            return new Array(size);
        }

        /**
     * @param value {Array|ArrayBuffer|Buffer|String}
     * @returns {Array}
     */

        function from(value) {
            if (!Bufferish.isBuffer(value) && Bufferish.isView(value)) {
                // TypedArray to Uint8Array
                value = Bufferish.Uint8Array.from(value);
            } else if (Bufferish.isArrayBuffer(value)) {
                // ArrayBuffer to Uint8Array
                value = new Uint8Array(value);
            } else if (typeof value === "string") {
                // String to Array
                return Bufferish.from.call(exports, value);
            } else if (typeof value === "number") {
                throw new TypeError('"value" argument must not be a number');
            }

            // Array-like to Array
            return Array.prototype.slice.call(value);
        }


        /***/
    }),

    /***/ "./node_modules/msgpack-lite/lib/bufferish-buffer.js":
    /*!***********************************************************!*\
  !*** ./node_modules/msgpack-lite/lib/bufferish-buffer.js ***!
  \***********************************************************/
    /*! no static exports found */
    /***/ (function (module, exports, __webpack_require__) {

        // bufferish-buffer.js

        var Bufferish = __webpack_require__(/*! ./bufferish */ "./node_modules/msgpack-lite/lib/bufferish.js");
        var Buffer = Bufferish.global;

        var exports = module.exports = Bufferish.hasBuffer ? alloc(0) : [];

        exports.alloc = Bufferish.hasBuffer && Buffer.alloc || alloc;
        exports.concat = Bufferish.concat;
        exports.from = from;

        /**
     * @param size {Number}
     * @returns {Buffer|Uint8Array|Array}
     */

        function alloc(size) {
            return new Buffer(size);
        }

        /**
     * @param value {Array|ArrayBuffer|Buffer|String}
     * @returns {Buffer}
     */

        function from(value) {
            if (!Bufferish.isBuffer(value) && Bufferish.isView(value)) {
                // TypedArray to Uint8Array
                value = Bufferish.Uint8Array.from(value);
            } else if (Bufferish.isArrayBuffer(value)) {
                // ArrayBuffer to Uint8Array
                value = new Uint8Array(value);
            } else if (typeof value === "string") {
                // String to Buffer
                return Bufferish.from.call(exports, value);
            } else if (typeof value === "number") {
                throw new TypeError('"value" argument must not be a number');
            }

            // Array-like to Buffer
            if (Buffer.from && Buffer.from.length !== 1) {
                return Buffer.from(value); // node v6+
            } else {
                return new Buffer(value); // node v4
            }
        }


        /***/
    }),

    /***/ "./node_modules/msgpack-lite/lib/bufferish-proto.js":
    /*!**********************************************************!*\
  !*** ./node_modules/msgpack-lite/lib/bufferish-proto.js ***!
  \**********************************************************/
    /*! no static exports found */
    /***/ (function (module, exports, __webpack_require__) {

        // bufferish-proto.js

        /* jshint eqnull:true */

        var BufferLite = __webpack_require__(/*! ./buffer-lite */ "./node_modules/msgpack-lite/lib/buffer-lite.js");

        exports.copy = copy;
        exports.slice = slice;
        exports.toString = toString;
        exports.write = gen("write");

        var Bufferish = __webpack_require__(/*! ./bufferish */ "./node_modules/msgpack-lite/lib/bufferish.js");
        var Buffer = Bufferish.global;

        var isBufferShim = Bufferish.hasBuffer && ("TYPED_ARRAY_SUPPORT" in Buffer);
        var brokenTypedArray = isBufferShim && !Buffer.TYPED_ARRAY_SUPPORT;

        /**
     * @param target {Buffer|Uint8Array|Array}
     * @param [targetStart] {Number}
     * @param [start] {Number}
     * @param [end] {Number}
     * @returns {Buffer|Uint8Array|Array}
     */

        function copy(target, targetStart, start, end) {
            var thisIsBuffer = Bufferish.isBuffer(this);
            var targetIsBuffer = Bufferish.isBuffer(target);
            if (thisIsBuffer && targetIsBuffer) {
                // Buffer to Buffer
                return this.copy(target, targetStart, start, end);
            } else if (!brokenTypedArray && !thisIsBuffer && !targetIsBuffer &&
                       Bufferish.isView(this) && Bufferish.isView(target)) {
                // Uint8Array to Uint8Array (except for minor some browsers)
                var buffer = (start || end != null) ? slice.call(this, start, end) : this;
                target.set(buffer, targetStart);
                return buffer.length;
            } else {
                // other cases
                return BufferLite.copy.call(this, target, targetStart, start, end);
            }
        }

        /**
     * @param [start] {Number}
     * @param [end] {Number}
     * @returns {Buffer|Uint8Array|Array}
     */

        function slice(start, end) {
            // for Buffer, Uint8Array (except for minor some browsers) and Array
            var f = this.slice || (!brokenTypedArray && this.subarray);
            if (f) return f.call(this, start, end);

            // Uint8Array (for minor some browsers)
            var target = Bufferish.alloc.call(this, end - start);
            copy.call(this, target, 0, start, end);
            return target;
        }

        /**
     * Buffer.prototype.toString()
     *
     * @param [encoding] {String} ignored
     * @param [start] {Number}
     * @param [end] {Number}
     * @returns {String}
     */

        function toString(encoding, start, end) {
            var f = (!isBufferShim && Bufferish.isBuffer(this)) ? this.toString : BufferLite.toString;
            return f.apply(this, arguments);
        }

        /**
     * @private
     */

        function gen(method) {
            return wrap;

            function wrap() {
                var f = this[method] || BufferLite[method];
                return f.apply(this, arguments);
            }
        }


        /***/
    }),

    /***/ "./node_modules/msgpack-lite/lib/bufferish-uint8array.js":
    /*!***************************************************************!*\
  !*** ./node_modules/msgpack-lite/lib/bufferish-uint8array.js ***!
  \***************************************************************/
    /*! no static exports found */
    /***/ (function (module, exports, __webpack_require__) {

        // bufferish-uint8array.js

        var Bufferish = __webpack_require__(/*! ./bufferish */ "./node_modules/msgpack-lite/lib/bufferish.js");

        var exports = module.exports = Bufferish.hasArrayBuffer ? alloc(0) : [];

        exports.alloc = alloc;
        exports.concat = Bufferish.concat;
        exports.from = from;

        /**
     * @param size {Number}
     * @returns {Buffer|Uint8Array|Array}
     */

        function alloc(size) {
            return new Uint8Array(size);
        }

        /**
     * @param value {Array|ArrayBuffer|Buffer|String}
     * @returns {Uint8Array}
     */

        function from(value) {
            if (Bufferish.isView(value)) {
                // TypedArray to ArrayBuffer
                var byteOffset = value.byteOffset;
                var byteLength = value.byteLength;
                value = value.buffer;
                if (value.byteLength !== byteLength) {
                    if (value.slice) {
                        value = value.slice(byteOffset, byteOffset + byteLength);
                    } else {
                        // Android 4.1 does not have ArrayBuffer.prototype.slice
                        value = new Uint8Array(value);
                        if (value.byteLength !== byteLength) {
                            // TypedArray to ArrayBuffer to Uint8Array to Array
                            value = Array.prototype.slice.call(value, byteOffset, byteOffset + byteLength);
                        }
                    }
                }
            } else if (typeof value === "string") {
                // String to Uint8Array
                return Bufferish.from.call(exports, value);
            } else if (typeof value === "number") {
                throw new TypeError('"value" argument must not be a number');
            }

            return new Uint8Array(value);
        }


        /***/
    }),

    /***/ "./node_modules/msgpack-lite/lib/bufferish.js":
    /*!****************************************************!*\
  !*** ./node_modules/msgpack-lite/lib/bufferish.js ***!
  \****************************************************/
    /*! no static exports found */
    /***/ (function (module, exports, __webpack_require__) {

        // bufferish.js

        var Buffer = exports.global = __webpack_require__(/*! ./buffer-global */ "./node_modules/msgpack-lite/lib/buffer-global.js");
        var hasBuffer = exports.hasBuffer = Buffer && !!Buffer.isBuffer;
        var hasArrayBuffer = exports.hasArrayBuffer = ("undefined" !== typeof ArrayBuffer);

        var isArray = exports.isArray = __webpack_require__(/*! isarray */ "./node_modules/msgpack-lite/node_modules/isarray/index.js");
        exports.isArrayBuffer = hasArrayBuffer ? isArrayBuffer : _false;
        var isBuffer = exports.isBuffer = hasBuffer ? Buffer.isBuffer : _false;
        var isView = exports.isView = hasArrayBuffer ? (ArrayBuffer.isView || _is("ArrayBuffer", "buffer")) : _false;

        exports.alloc = alloc;
        exports.concat = concat;
        exports.from = from;

        var BufferArray = exports.Array = __webpack_require__(/*! ./bufferish-array */ "./node_modules/msgpack-lite/lib/bufferish-array.js");
        var BufferBuffer = exports.Buffer = __webpack_require__(/*! ./bufferish-buffer */ "./node_modules/msgpack-lite/lib/bufferish-buffer.js");
        var BufferUint8Array = exports.Uint8Array = __webpack_require__(/*! ./bufferish-uint8array */ "./node_modules/msgpack-lite/lib/bufferish-uint8array.js");
        var BufferProto = exports.prototype = __webpack_require__(/*! ./bufferish-proto */ "./node_modules/msgpack-lite/lib/bufferish-proto.js");

        /**
     * @param value {Array|ArrayBuffer|Buffer|String}
     * @returns {Buffer|Uint8Array|Array}
     */

        function from(value) {
            if (typeof value === "string") {
                return fromString.call(this, value);
            } else {
                return auto(this).from(value);
            }
        }

        /**
     * @param size {Number}
     * @returns {Buffer|Uint8Array|Array}
     */

        function alloc(size) {
            return auto(this).alloc(size);
        }

        /**
     * @param list {Array} array of (Buffer|Uint8Array|Array)s
     * @param [length]
     * @returns {Buffer|Uint8Array|Array}
     */

        function concat(list, length) {
            if (!length) {
                length = 0;
                Array.prototype.forEach.call(list, dryrun);
            }
            var ref = (this !== exports) && this || list[0];
            var result = alloc.call(ref, length);
            var offset = 0;
            Array.prototype.forEach.call(list, append);
            return result;

            function dryrun(buffer) {
                length += buffer.length;
            }

            function append(buffer) {
                offset += BufferProto.copy.call(buffer, result, offset);
            }
        }

        var _isArrayBuffer = _is("ArrayBuffer");

        function isArrayBuffer(value) {
            return (value instanceof ArrayBuffer) || _isArrayBuffer(value);
        }

        /**
     * @private
     */

        function fromString(value) {
            var expected = value.length * 3;
            var that = alloc.call(this, expected);
            var actual = BufferProto.write.call(that, value);
            if (expected !== actual) {
                that = BufferProto.slice.call(that, 0, actual);
            }
            return that;
        }

        function auto(that) {
            return isBuffer(that) ? BufferBuffer
            : isView(that) ? BufferUint8Array
            : isArray(that) ? BufferArray
            : hasBuffer ? BufferBuffer
            : hasArrayBuffer ? BufferUint8Array
            : BufferArray;
        }

        function _false() {
            return false;
        }

        function _is(name, key) {
            /* jshint eqnull:true */
            name = "[object " + name + "]";
            return function (value) {
                return (value != null) && {}.toString.call(key ? value[key] : value) === name;
            };
        }

        /***/
    }),

    /***/ "./node_modules/msgpack-lite/lib/codec-base.js":
    /*!*****************************************************!*\
  !*** ./node_modules/msgpack-lite/lib/codec-base.js ***!
  \*****************************************************/
    /*! no static exports found */
    /***/ (function (module, exports, __webpack_require__) {

        // codec-base.js

        var IS_ARRAY = __webpack_require__(/*! isarray */ "./node_modules/msgpack-lite/node_modules/isarray/index.js");

        exports.createCodec = createCodec;
        exports.install = install;
        exports.filter = filter;

        var Bufferish = __webpack_require__(/*! ./bufferish */ "./node_modules/msgpack-lite/lib/bufferish.js");

        function Codec(options) {
            if (!(this instanceof Codec)) return new Codec(options);
            this.options = options;
            this.init();
        }

        Codec.prototype.init = function () {
            var options = this.options;

            if (options && options.uint8array) {
                this.bufferish = Bufferish.Uint8Array;
            }

            return this;
        };

        function install(props) {
            for (var key in props) {
                Codec.prototype[key] = add(Codec.prototype[key], props[key]);
            }
        }

        function add(a, b) {
            return (a && b) ? ab : (a || b);

            function ab() {
                a.apply(this, arguments);
                return b.apply(this, arguments);
            }
        }

        function join(filters) {
            filters = filters.slice();

            return function (value) {
                return filters.reduce(iterator, value);
            };

            function iterator(value, filter) {
                return filter(value);
            }
        }

        function filter(filter) {
            return IS_ARRAY(filter) ? join(filter) : filter;
        }

        // @public
        // msgpack.createCodec()

        function createCodec(options) {
            return new Codec(options);
        }

        // default shared codec

        exports.preset = createCodec({ preset: true });


        /***/
    }),

    /***/ "./node_modules/msgpack-lite/lib/codec.js":
    /*!************************************************!*\
  !*** ./node_modules/msgpack-lite/lib/codec.js ***!
  \************************************************/
    /*! no static exports found */
    /***/ (function (module, exports, __webpack_require__) {

        // codec.js

        // load both interfaces
        __webpack_require__(/*! ./read-core */ "./node_modules/msgpack-lite/lib/read-core.js");
        __webpack_require__(/*! ./write-core */ "./node_modules/msgpack-lite/lib/write-core.js");

        // @public
        // msgpack.codec.preset

        exports.codec = {
            preset: __webpack_require__(/*! ./codec-base */ "./node_modules/msgpack-lite/lib/codec-base.js").preset
        };


        /***/
    }),

    /***/ "./node_modules/msgpack-lite/lib/decode-buffer.js":
    /*!********************************************************!*\
  !*** ./node_modules/msgpack-lite/lib/decode-buffer.js ***!
  \********************************************************/
    /*! no static exports found */
    /***/ (function (module, exports, __webpack_require__) {

        // decode-buffer.js

        exports.DecodeBuffer = DecodeBuffer;

        var preset = __webpack_require__(/*! ./read-core */ "./node_modules/msgpack-lite/lib/read-core.js").preset;

        var FlexDecoder = __webpack_require__(/*! ./flex-buffer */ "./node_modules/msgpack-lite/lib/flex-buffer.js").FlexDecoder;

        FlexDecoder.mixin(DecodeBuffer.prototype);

        function DecodeBuffer(options) {
            if (!(this instanceof DecodeBuffer)) return new DecodeBuffer(options);

            if (options) {
                this.options = options;
                if (options.codec) {
                    var codec = this.codec = options.codec;
                    if (codec.bufferish) this.bufferish = codec.bufferish;
                }
            }
        }

        DecodeBuffer.prototype.codec = preset;

        DecodeBuffer.prototype.fetch = function () {
            return this.codec.decode(this);
        };


        /***/
    }),

    /***/ "./node_modules/msgpack-lite/lib/decode.js":
    /*!*************************************************!*\
  !*** ./node_modules/msgpack-lite/lib/decode.js ***!
  \*************************************************/
    /*! no static exports found */
    /***/ (function (module, exports, __webpack_require__) {

        // decode.js

        exports.decode = decode;

        var DecodeBuffer = __webpack_require__(/*! ./decode-buffer */ "./node_modules/msgpack-lite/lib/decode-buffer.js").DecodeBuffer;

        function decode(input, options) {
            var decoder = new DecodeBuffer(options);
            decoder.write(input);
            return decoder.read();
        }

        /***/
    }),

    /***/ "./node_modules/msgpack-lite/lib/decoder.js":
    /*!**************************************************!*\
  !*** ./node_modules/msgpack-lite/lib/decoder.js ***!
  \**************************************************/
    /*! no static exports found */
    /***/ (function (module, exports, __webpack_require__) {

        // decoder.js

        exports.Decoder = Decoder;

        var EventLite = __webpack_require__(/*! event-lite */ "./node_modules/event-lite/event-lite.js");
        var DecodeBuffer = __webpack_require__(/*! ./decode-buffer */ "./node_modules/msgpack-lite/lib/decode-buffer.js").DecodeBuffer;

        function Decoder(options) {
            if (!(this instanceof Decoder)) return new Decoder(options);
            DecodeBuffer.call(this, options);
        }

        Decoder.prototype = new DecodeBuffer();

        EventLite.mixin(Decoder.prototype);

        Decoder.prototype.decode = function (chunk) {
            if (arguments.length) this.write(chunk);
            this.flush();
        };

        Decoder.prototype.push = function (chunk) {
            this.emit("data", chunk);
        };

        Decoder.prototype.end = function (chunk) {
            this.decode(chunk);
            this.emit("end");
        };


        /***/
    }),

    /***/ "./node_modules/msgpack-lite/lib/encode-buffer.js":
    /*!********************************************************!*\
  !*** ./node_modules/msgpack-lite/lib/encode-buffer.js ***!
  \********************************************************/
    /*! no static exports found */
    /***/ (function (module, exports, __webpack_require__) {

        // encode-buffer.js

        exports.EncodeBuffer = EncodeBuffer;

        var preset = __webpack_require__(/*! ./write-core */ "./node_modules/msgpack-lite/lib/write-core.js").preset;

        var FlexEncoder = __webpack_require__(/*! ./flex-buffer */ "./node_modules/msgpack-lite/lib/flex-buffer.js").FlexEncoder;

        FlexEncoder.mixin(EncodeBuffer.prototype);

        function EncodeBuffer(options) {
            if (!(this instanceof EncodeBuffer)) return new EncodeBuffer(options);

            if (options) {
                this.options = options;
                if (options.codec) {
                    var codec = this.codec = options.codec;
                    if (codec.bufferish) this.bufferish = codec.bufferish;
                }
            }
        }

        EncodeBuffer.prototype.codec = preset;

        EncodeBuffer.prototype.write = function (input) {
            this.codec.encode(this, input);
        };


        /***/
    }),

    /***/ "./node_modules/msgpack-lite/lib/encode.js":
    /*!*************************************************!*\
  !*** ./node_modules/msgpack-lite/lib/encode.js ***!
  \*************************************************/
    /*! no static exports found */
    /***/ (function (module, exports, __webpack_require__) {

        // encode.js

        exports.encode = encode;

        var EncodeBuffer = __webpack_require__(/*! ./encode-buffer */ "./node_modules/msgpack-lite/lib/encode-buffer.js").EncodeBuffer;

        function encode(input, options) {
            var encoder = new EncodeBuffer(options);
            encoder.write(input);
            return encoder.read();
        }


        /***/
    }),

    /***/ "./node_modules/msgpack-lite/lib/encoder.js":
    /*!**************************************************!*\
  !*** ./node_modules/msgpack-lite/lib/encoder.js ***!
  \**************************************************/
    /*! no static exports found */
    /***/ (function (module, exports, __webpack_require__) {

        // encoder.js

        exports.Encoder = Encoder;

        var EventLite = __webpack_require__(/*! event-lite */ "./node_modules/event-lite/event-lite.js");
        var EncodeBuffer = __webpack_require__(/*! ./encode-buffer */ "./node_modules/msgpack-lite/lib/encode-buffer.js").EncodeBuffer;

        function Encoder(options) {
            if (!(this instanceof Encoder)) return new Encoder(options);
            EncodeBuffer.call(this, options);
        }

        Encoder.prototype = new EncodeBuffer();

        EventLite.mixin(Encoder.prototype);

        Encoder.prototype.encode = function (chunk) {
            this.write(chunk);
            this.emit("data", this.read());
        };

        Encoder.prototype.end = function (chunk) {
            if (arguments.length) this.encode(chunk);
            this.flush();
            this.emit("end");
        };


        /***/
    }),

    /***/ "./node_modules/msgpack-lite/lib/ext-buffer.js":
    /*!*****************************************************!*\
  !*** ./node_modules/msgpack-lite/lib/ext-buffer.js ***!
  \*****************************************************/
    /*! no static exports found */
    /***/ (function (module, exports, __webpack_require__) {

        // ext-buffer.js

        exports.ExtBuffer = ExtBuffer;

        var Bufferish = __webpack_require__(/*! ./bufferish */ "./node_modules/msgpack-lite/lib/bufferish.js");

        function ExtBuffer(buffer, type) {
            if (!(this instanceof ExtBuffer)) return new ExtBuffer(buffer, type);
            this.buffer = Bufferish.from(buffer);
            this.type = type;
        }


        /***/
    }),

    /***/ "./node_modules/msgpack-lite/lib/ext-packer.js":
    /*!*****************************************************!*\
  !*** ./node_modules/msgpack-lite/lib/ext-packer.js ***!
  \*****************************************************/
    /*! no static exports found */
    /***/ (function (module, exports, __webpack_require__) {

        // ext-packer.js

        exports.setExtPackers = setExtPackers;

        var Bufferish = __webpack_require__(/*! ./bufferish */ "./node_modules/msgpack-lite/lib/bufferish.js");
        var Buffer = Bufferish.global;
        var packTypedArray = Bufferish.Uint8Array.from;
        var _encode;

        var ERROR_COLUMNS = { name: 1, message: 1, stack: 1, columnNumber: 1, fileName: 1, lineNumber: 1 };

        function setExtPackers(codec) {
            codec.addExtPacker(0x0E, Error, [packError, encode]);
            codec.addExtPacker(0x01, EvalError, [packError, encode]);
            codec.addExtPacker(0x02, RangeError, [packError, encode]);
            codec.addExtPacker(0x03, ReferenceError, [packError, encode]);
            codec.addExtPacker(0x04, SyntaxError, [packError, encode]);
            codec.addExtPacker(0x05, TypeError, [packError, encode]);
            codec.addExtPacker(0x06, URIError, [packError, encode]);

            codec.addExtPacker(0x0A, RegExp, [packRegExp, encode]);
            codec.addExtPacker(0x0B, Boolean, [packValueOf, encode]);
            codec.addExtPacker(0x0C, String, [packValueOf, encode]);
            codec.addExtPacker(0x0D, Date, [Number, encode]);
            codec.addExtPacker(0x0F, Number, [packValueOf, encode]);

            if ("undefined" !== typeof Uint8Array) {
                codec.addExtPacker(0x11, Int8Array, packTypedArray);
                codec.addExtPacker(0x12, Uint8Array, packTypedArray);
                codec.addExtPacker(0x13, Int16Array, packTypedArray);
                codec.addExtPacker(0x14, Uint16Array, packTypedArray);
                codec.addExtPacker(0x15, Int32Array, packTypedArray);
                codec.addExtPacker(0x16, Uint32Array, packTypedArray);
                codec.addExtPacker(0x17, Float32Array, packTypedArray);

                // PhantomJS/1.9.7 doesn't have Float64Array
                if ("undefined" !== typeof Float64Array) {
                    codec.addExtPacker(0x18, Float64Array, packTypedArray);
                }

                // IE10 doesn't have Uint8ClampedArray
                if ("undefined" !== typeof Uint8ClampedArray) {
                    codec.addExtPacker(0x19, Uint8ClampedArray, packTypedArray);
                }

                codec.addExtPacker(0x1A, ArrayBuffer, packTypedArray);
                codec.addExtPacker(0x1D, DataView, packTypedArray);
            }

            if (Bufferish.hasBuffer) {
                codec.addExtPacker(0x1B, Buffer, Bufferish.from);
            }
        }

        function encode(input) {
            if (!_encode) _encode = __webpack_require__(/*! ./encode */ "./node_modules/msgpack-lite/lib/encode.js").encode; // lazy load
            return _encode(input);
        }

        function packValueOf(value) {
            return (value).valueOf();
        }

        function packRegExp(value) {
            value = RegExp.prototype.toString.call(value).split("/");
            value.shift();
            var out = [value.pop()];
            out.unshift(value.join("/"));
            return out;
        }

        function packError(value) {
            var out = {};
            for (var key in ERROR_COLUMNS) {
                out[key] = value[key];
            }
            return out;
        }


        /***/
    }),

    /***/ "./node_modules/msgpack-lite/lib/ext-unpacker.js":
    /*!*******************************************************!*\
  !*** ./node_modules/msgpack-lite/lib/ext-unpacker.js ***!
  \*******************************************************/
    /*! no static exports found */
    /***/ (function (module, exports, __webpack_require__) {

        // ext-unpacker.js

        exports.setExtUnpackers = setExtUnpackers;

        var Bufferish = __webpack_require__(/*! ./bufferish */ "./node_modules/msgpack-lite/lib/bufferish.js");
        var Buffer = Bufferish.global;
        var _decode;

        var ERROR_COLUMNS = { name: 1, message: 1, stack: 1, columnNumber: 1, fileName: 1, lineNumber: 1 };

        function setExtUnpackers(codec) {
            codec.addExtUnpacker(0x0E, [decode, unpackError(Error)]);
            codec.addExtUnpacker(0x01, [decode, unpackError(EvalError)]);
            codec.addExtUnpacker(0x02, [decode, unpackError(RangeError)]);
            codec.addExtUnpacker(0x03, [decode, unpackError(ReferenceError)]);
            codec.addExtUnpacker(0x04, [decode, unpackError(SyntaxError)]);
            codec.addExtUnpacker(0x05, [decode, unpackError(TypeError)]);
            codec.addExtUnpacker(0x06, [decode, unpackError(URIError)]);

            codec.addExtUnpacker(0x0A, [decode, unpackRegExp]);
            codec.addExtUnpacker(0x0B, [decode, unpackClass(Boolean)]);
            codec.addExtUnpacker(0x0C, [decode, unpackClass(String)]);
            codec.addExtUnpacker(0x0D, [decode, unpackClass(Date)]);
            codec.addExtUnpacker(0x0F, [decode, unpackClass(Number)]);

            if ("undefined" !== typeof Uint8Array) {
                codec.addExtUnpacker(0x11, unpackClass(Int8Array));
                codec.addExtUnpacker(0x12, unpackClass(Uint8Array));
                codec.addExtUnpacker(0x13, [unpackArrayBuffer, unpackClass(Int16Array)]);
                codec.addExtUnpacker(0x14, [unpackArrayBuffer, unpackClass(Uint16Array)]);
                codec.addExtUnpacker(0x15, [unpackArrayBuffer, unpackClass(Int32Array)]);
                codec.addExtUnpacker(0x16, [unpackArrayBuffer, unpackClass(Uint32Array)]);
                codec.addExtUnpacker(0x17, [unpackArrayBuffer, unpackClass(Float32Array)]);

                // PhantomJS/1.9.7 doesn't have Float64Array
                if ("undefined" !== typeof Float64Array) {
                    codec.addExtUnpacker(0x18, [unpackArrayBuffer, unpackClass(Float64Array)]);
                }

                // IE10 doesn't have Uint8ClampedArray
                if ("undefined" !== typeof Uint8ClampedArray) {
                    codec.addExtUnpacker(0x19, unpackClass(Uint8ClampedArray));
                }

                codec.addExtUnpacker(0x1A, unpackArrayBuffer);
                codec.addExtUnpacker(0x1D, [unpackArrayBuffer, unpackClass(DataView)]);
            }

            if (Bufferish.hasBuffer) {
                codec.addExtUnpacker(0x1B, unpackClass(Buffer));
            }
        }

        function decode(input) {
            if (!_decode) _decode = __webpack_require__(/*! ./decode */ "./node_modules/msgpack-lite/lib/decode.js").decode; // lazy load
            return _decode(input);
        }

        function unpackRegExp(value) {
            return RegExp.apply(null, value);
        }

        function unpackError(Class) {
            return function (value) {
                var out = new Class();
                for (var key in ERROR_COLUMNS) {
                    out[key] = value[key];
                }
                return out;
            };
        }

        function unpackClass(Class) {
            return function (value) {
                return new Class(value);
            };
        }

        function unpackArrayBuffer(value) {
            return (new Uint8Array(value)).buffer;
        }


        /***/
    }),

    /***/ "./node_modules/msgpack-lite/lib/ext.js":
    /*!**********************************************!*\
  !*** ./node_modules/msgpack-lite/lib/ext.js ***!
  \**********************************************/
    /*! no static exports found */
    /***/ (function (module, exports, __webpack_require__) {

        // ext.js

        // load both interfaces
        __webpack_require__(/*! ./read-core */ "./node_modules/msgpack-lite/lib/read-core.js");
        __webpack_require__(/*! ./write-core */ "./node_modules/msgpack-lite/lib/write-core.js");

        exports.createCodec = __webpack_require__(/*! ./codec-base */ "./node_modules/msgpack-lite/lib/codec-base.js").createCodec;


        /***/
    }),

    /***/ "./node_modules/msgpack-lite/lib/flex-buffer.js":
    /*!******************************************************!*\
  !*** ./node_modules/msgpack-lite/lib/flex-buffer.js ***!
  \******************************************************/
    /*! no static exports found */
    /***/ (function (module, exports, __webpack_require__) {

        // flex-buffer.js

        exports.FlexDecoder = FlexDecoder;
        exports.FlexEncoder = FlexEncoder;

        var Bufferish = __webpack_require__(/*! ./bufferish */ "./node_modules/msgpack-lite/lib/bufferish.js");

        var MIN_BUFFER_SIZE = 2048;
        var MAX_BUFFER_SIZE = 65536;
        var BUFFER_SHORTAGE = "BUFFER_SHORTAGE";

        function FlexDecoder() {
            if (!(this instanceof FlexDecoder)) return new FlexDecoder();
        }

        function FlexEncoder() {
            if (!(this instanceof FlexEncoder)) return new FlexEncoder();
        }

        FlexDecoder.mixin = mixinFactory(getDecoderMethods());
        FlexDecoder.mixin(FlexDecoder.prototype);

        FlexEncoder.mixin = mixinFactory(getEncoderMethods());
        FlexEncoder.mixin(FlexEncoder.prototype);

        function getDecoderMethods() {
            return {
                bufferish: Bufferish,
                write: write,
                fetch: fetch,
                flush: flush,
                push: push,
                pull: pull,
                read: read,
                reserve: reserve,
                offset: 0
            };

            function write(chunk) {
                var prev = this.offset ? Bufferish.prototype.slice.call(this.buffer, this.offset) : this.buffer;
                this.buffer = prev ? (chunk ? this.bufferish.concat([prev, chunk]) : prev) : chunk;
                this.offset = 0;
            }

            function flush() {
                while (this.offset < this.buffer.length) {
                    var start = this.offset;
                    var value;
                    try {
                        value = this.fetch();
                    } catch (e) {
                        if (e && e.message != BUFFER_SHORTAGE) throw e;
                        // rollback
                        this.offset = start;
                        break;
                    }
                    this.push(value);
                }
            }

            function reserve(length) {
                var start = this.offset;
                var end = start + length;
                if (end > this.buffer.length) throw new Error(BUFFER_SHORTAGE);
                this.offset = end;
                return start;
            }
        }

        function getEncoderMethods() {
            return {
                bufferish: Bufferish,
                write: write,
                fetch: fetch,
                flush: flush,
                push: push,
                pull: pull,
                read: read,
                reserve: reserve,
                send: send,
                maxBufferSize: MAX_BUFFER_SIZE,
                minBufferSize: MIN_BUFFER_SIZE,
                offset: 0,
                start: 0
            };

            function fetch() {
                var start = this.start;
                if (start < this.offset) {
                    var end = this.start = this.offset;
                    return Bufferish.prototype.slice.call(this.buffer, start, end);
                }
            }

            function flush() {
                while (this.start < this.offset) {
                    var value = this.fetch();
                    if (value) this.push(value);
                }
            }

            function pull() {
                var buffers = this.buffers || (this.buffers = []);
                var chunk = buffers.length > 1 ? this.bufferish.concat(buffers) : buffers[0];
                buffers.length = 0; // buffer exhausted
                return chunk;
            }

            function reserve(length) {
                var req = length | 0;

                if (this.buffer) {
                    var size = this.buffer.length;
                    var start = this.offset | 0;
                    var end = start + req;

                    // is it long enough?
                    if (end < size) {
                        this.offset = end;
                        return start;
                    }

                    // flush current buffer
                    this.flush();

                    // resize it to 2x current length
                    length = Math.max(length, Math.min(size * 2, this.maxBufferSize));
                }

                // minimum buffer size
                length = Math.max(length, this.minBufferSize);

                // allocate new buffer
                this.buffer = this.bufferish.alloc(length);
                this.start = 0;
                this.offset = req;
                return 0;
            }

            function send(buffer) {
                var length = buffer.length;
                if (length > this.minBufferSize) {
                    this.flush();
                    this.push(buffer);
                } else {
                    var offset = this.reserve(length);
                    Bufferish.prototype.copy.call(buffer, this.buffer, offset);
                }
            }
        }

        // common methods

        function write() {
            throw new Error("method not implemented: write()");
        }

        function fetch() {
            throw new Error("method not implemented: fetch()");
        }

        function read() {
            var length = this.buffers && this.buffers.length;

            // fetch the first result
            if (!length) return this.fetch();

            // flush current buffer
            this.flush();

            // read from the results
            return this.pull();
        }

        function push(chunk) {
            var buffers = this.buffers || (this.buffers = []);
            buffers.push(chunk);
        }

        function pull() {
            var buffers = this.buffers || (this.buffers = []);
            return buffers.shift();
        }

        function mixinFactory(source) {
            return mixin;

            function mixin(target) {
                for (var key in source) {
                    target[key] = source[key];
                }
                return target;
            }
        }


        /***/
    }),

    /***/ "./node_modules/msgpack-lite/lib/read-core.js":
    /*!****************************************************!*\
  !*** ./node_modules/msgpack-lite/lib/read-core.js ***!
  \****************************************************/
    /*! no static exports found */
    /***/ (function (module, exports, __webpack_require__) {

        // read-core.js

        var ExtBuffer = __webpack_require__(/*! ./ext-buffer */ "./node_modules/msgpack-lite/lib/ext-buffer.js").ExtBuffer;
        var ExtUnpacker = __webpack_require__(/*! ./ext-unpacker */ "./node_modules/msgpack-lite/lib/ext-unpacker.js");
        var readUint8 = __webpack_require__(/*! ./read-format */ "./node_modules/msgpack-lite/lib/read-format.js").readUint8;
        var ReadToken = __webpack_require__(/*! ./read-token */ "./node_modules/msgpack-lite/lib/read-token.js");
        var CodecBase = __webpack_require__(/*! ./codec-base */ "./node_modules/msgpack-lite/lib/codec-base.js");

        CodecBase.install({
            addExtUnpacker: addExtUnpacker,
            getExtUnpacker: getExtUnpacker,
            init: init
        });

        exports.preset = init.call(CodecBase.preset);

        function getDecoder(options) {
            var readToken = ReadToken.getReadToken(options);
            return decode;

            function decode(decoder) {
                var type = readUint8(decoder);
                var func = readToken[type];
                if (!func) throw new Error("Invalid type: " + (type ? ("0x" + type.toString(16)) : type));
                return func(decoder);
            }
        }

        function init() {
            var options = this.options;
            this.decode = getDecoder(options);

            if (options && options.preset) {
                ExtUnpacker.setExtUnpackers(this);
            }

            return this;
        }

        function addExtUnpacker(etype, unpacker) {
            var unpackers = this.extUnpackers || (this.extUnpackers = []);
            unpackers[etype] = CodecBase.filter(unpacker);
        }

        function getExtUnpacker(type) {
            var unpackers = this.extUnpackers || (this.extUnpackers = []);
            return unpackers[type] || extUnpacker;

            function extUnpacker(buffer) {
                return new ExtBuffer(buffer, type);
            }
        }


        /***/
    }),

    /***/ "./node_modules/msgpack-lite/lib/read-format.js":
    /*!******************************************************!*\
  !*** ./node_modules/msgpack-lite/lib/read-format.js ***!
  \******************************************************/
    /*! no static exports found */
    /***/ (function (module, exports, __webpack_require__) {

        // read-format.js

        var ieee754 = __webpack_require__(/*! ieee754 */ "./node_modules/ieee754/index.js");
        var Int64Buffer = __webpack_require__(/*! int64-buffer */ "./node_modules/int64-buffer/int64-buffer.js");
        var Uint64BE = Int64Buffer.Uint64BE;
        var Int64BE = Int64Buffer.Int64BE;

        exports.getReadFormat = getReadFormat;
        exports.readUint8 = uint8;

        var Bufferish = __webpack_require__(/*! ./bufferish */ "./node_modules/msgpack-lite/lib/bufferish.js");
        var BufferProto = __webpack_require__(/*! ./bufferish-proto */ "./node_modules/msgpack-lite/lib/bufferish-proto.js");

        var HAS_MAP = ("undefined" !== typeof Map);
        var NO_ASSERT = true;

        function getReadFormat(options) {
            var binarraybuffer = Bufferish.hasArrayBuffer && options && options.binarraybuffer;
            var int64 = options && options.int64;
            var usemap = HAS_MAP && options && options.usemap;

            var readFormat = {
                map: (usemap ? map_to_map : map_to_obj),
                array: array,
                str: str,
                bin: (binarraybuffer ? bin_arraybuffer : bin_buffer),
                ext: ext,
                uint8: uint8,
                uint16: uint16,
                uint32: uint32,
                uint64: read(8, int64 ? readUInt64BE_int64 : readUInt64BE),
                int8: int8,
                int16: int16,
                int32: int32,
                int64: read(8, int64 ? readInt64BE_int64 : readInt64BE),
                float32: read(4, readFloatBE),
                float64: read(8, readDoubleBE)
            };

            return readFormat;
        }

        function map_to_obj(decoder, len) {
            var value = {};
            var i;
            var k = new Array(len);
            var v = new Array(len);

            var decode = decoder.codec.decode;
            for (i = 0; i < len; i++) {
                k[i] = decode(decoder);
                v[i] = decode(decoder);
            }
            for (i = 0; i < len; i++) {
                value[k[i]] = v[i];
            }
            return value;
        }

        function map_to_map(decoder, len) {
            var value = new Map();
            var i;
            var k = new Array(len);
            var v = new Array(len);

            var decode = decoder.codec.decode;
            for (i = 0; i < len; i++) {
                k[i] = decode(decoder);
                v[i] = decode(decoder);
            }
            for (i = 0; i < len; i++) {
                value.set(k[i], v[i]);
            }
            return value;
        }

        function array(decoder, len) {
            var value = new Array(len);
            var decode = decoder.codec.decode;
            for (var i = 0; i < len; i++) {
                value[i] = decode(decoder);
            }
            return value;
        }

        function str(decoder, len) {
            var start = decoder.reserve(len);
            var end = start + len;
            return BufferProto.toString.call(decoder.buffer, "utf-8", start, end);
        }

        function bin_buffer(decoder, len) {
            var start = decoder.reserve(len);
            var end = start + len;
            var buf = BufferProto.slice.call(decoder.buffer, start, end);
            return Bufferish.from(buf);
        }

        function bin_arraybuffer(decoder, len) {
            var start = decoder.reserve(len);
            var end = start + len;
            var buf = BufferProto.slice.call(decoder.buffer, start, end);
            return Bufferish.Uint8Array.from(buf).buffer;
        }

        function ext(decoder, len) {
            var start = decoder.reserve(len + 1);
            var type = decoder.buffer[start++];
            var end = start + len;
            var unpack = decoder.codec.getExtUnpacker(type);
            if (!unpack) throw new Error("Invalid ext type: " + (type ? ("0x" + type.toString(16)) : type));
            var buf = BufferProto.slice.call(decoder.buffer, start, end);
            return unpack(buf);
        }

        function uint8(decoder) {
            var start = decoder.reserve(1);
            return decoder.buffer[start];
        }

        function int8(decoder) {
            var start = decoder.reserve(1);
            var value = decoder.buffer[start];
            return (value & 0x80) ? value - 0x100 : value;
        }

        function uint16(decoder) {
            var start = decoder.reserve(2);
            var buffer = decoder.buffer;
            return (buffer[start++] << 8) | buffer[start];
        }

        function int16(decoder) {
            var start = decoder.reserve(2);
            var buffer = decoder.buffer;
            var value = (buffer[start++] << 8) | buffer[start];
            return (value & 0x8000) ? value - 0x10000 : value;
        }

        function uint32(decoder) {
            var start = decoder.reserve(4);
            var buffer = decoder.buffer;
            return (buffer[start++] * 16777216) + (buffer[start++] << 16) + (buffer[start++] << 8) + buffer[start];
        }

        function int32(decoder) {
            var start = decoder.reserve(4);
            var buffer = decoder.buffer;
            return (buffer[start++] << 24) | (buffer[start++] << 16) | (buffer[start++] << 8) | buffer[start];
        }

        function read(len, method) {
            return function (decoder) {
                var start = decoder.reserve(len);
                return method.call(decoder.buffer, start, NO_ASSERT);
            };
        }

        function readUInt64BE(start) {
            return new Uint64BE(this, start).toNumber();
        }

        function readInt64BE(start) {
            return new Int64BE(this, start).toNumber();
        }

        function readUInt64BE_int64(start) {
            return new Uint64BE(this, start);
        }

        function readInt64BE_int64(start) {
            return new Int64BE(this, start);
        }

        function readFloatBE(start) {
            return ieee754.read(this, start, false, 23, 4);
        }

        function readDoubleBE(start) {
            return ieee754.read(this, start, false, 52, 8);
        }

        /***/
    }),

    /***/ "./node_modules/msgpack-lite/lib/read-token.js":
    /*!*****************************************************!*\
  !*** ./node_modules/msgpack-lite/lib/read-token.js ***!
  \*****************************************************/
    /*! no static exports found */
    /***/ (function (module, exports, __webpack_require__) {

        // read-token.js

        var ReadFormat = __webpack_require__(/*! ./read-format */ "./node_modules/msgpack-lite/lib/read-format.js");

        exports.getReadToken = getReadToken;

        function getReadToken(options) {
            var format = ReadFormat.getReadFormat(options);

            if (options && options.useraw) {
                return init_useraw(format);
            } else {
                return init_token(format);
            }
        }

        function init_token(format) {
            var i;
            var token = new Array(256);

            // positive fixint -- 0x00 - 0x7f
            for (i = 0x00; i <= 0x7f; i++) {
                token[i] = constant(i);
            }

            // fixmap -- 0x80 - 0x8f
            for (i = 0x80; i <= 0x8f; i++) {
                token[i] = fix(i - 0x80, format.map);
            }

            // fixarray -- 0x90 - 0x9f
            for (i = 0x90; i <= 0x9f; i++) {
                token[i] = fix(i - 0x90, format.array);
            }

            // fixstr -- 0xa0 - 0xbf
            for (i = 0xa0; i <= 0xbf; i++) {
                token[i] = fix(i - 0xa0, format.str);
            }

            // nil -- 0xc0
            token[0xc0] = constant(null);

            // (never used) -- 0xc1
            token[0xc1] = null;

            // false -- 0xc2
            // true -- 0xc3
            token[0xc2] = constant(false);
            token[0xc3] = constant(true);

            // bin 8 -- 0xc4
            // bin 16 -- 0xc5
            // bin 32 -- 0xc6
            token[0xc4] = flex(format.uint8, format.bin);
            token[0xc5] = flex(format.uint16, format.bin);
            token[0xc6] = flex(format.uint32, format.bin);

            // ext 8 -- 0xc7
            // ext 16 -- 0xc8
            // ext 32 -- 0xc9
            token[0xc7] = flex(format.uint8, format.ext);
            token[0xc8] = flex(format.uint16, format.ext);
            token[0xc9] = flex(format.uint32, format.ext);

            // float 32 -- 0xca
            // float 64 -- 0xcb
            token[0xca] = format.float32;
            token[0xcb] = format.float64;

            // uint 8 -- 0xcc
            // uint 16 -- 0xcd
            // uint 32 -- 0xce
            // uint 64 -- 0xcf
            token[0xcc] = format.uint8;
            token[0xcd] = format.uint16;
            token[0xce] = format.uint32;
            token[0xcf] = format.uint64;

            // int 8 -- 0xd0
            // int 16 -- 0xd1
            // int 32 -- 0xd2
            // int 64 -- 0xd3
            token[0xd0] = format.int8;
            token[0xd1] = format.int16;
            token[0xd2] = format.int32;
            token[0xd3] = format.int64;

            // fixext 1 -- 0xd4
            // fixext 2 -- 0xd5
            // fixext 4 -- 0xd6
            // fixext 8 -- 0xd7
            // fixext 16 -- 0xd8
            token[0xd4] = fix(1, format.ext);
            token[0xd5] = fix(2, format.ext);
            token[0xd6] = fix(4, format.ext);
            token[0xd7] = fix(8, format.ext);
            token[0xd8] = fix(16, format.ext);

            // str 8 -- 0xd9
            // str 16 -- 0xda
            // str 32 -- 0xdb
            token[0xd9] = flex(format.uint8, format.str);
            token[0xda] = flex(format.uint16, format.str);
            token[0xdb] = flex(format.uint32, format.str);

            // array 16 -- 0xdc
            // array 32 -- 0xdd
            token[0xdc] = flex(format.uint16, format.array);
            token[0xdd] = flex(format.uint32, format.array);

            // map 16 -- 0xde
            // map 32 -- 0xdf
            token[0xde] = flex(format.uint16, format.map);
            token[0xdf] = flex(format.uint32, format.map);

            // negative fixint -- 0xe0 - 0xff
            for (i = 0xe0; i <= 0xff; i++) {
                token[i] = constant(i - 0x100);
            }

            return token;
        }

        function init_useraw(format) {
            var i;
            var token = init_token(format).slice();

            // raw 8 -- 0xd9
            // raw 16 -- 0xda
            // raw 32 -- 0xdb
            token[0xd9] = token[0xc4];
            token[0xda] = token[0xc5];
            token[0xdb] = token[0xc6];

            // fixraw -- 0xa0 - 0xbf
            for (i = 0xa0; i <= 0xbf; i++) {
                token[i] = fix(i - 0xa0, format.bin);
            }

            return token;
        }

        function constant(value) {
            return function () {
                return value;
            };
        }

        function flex(lenFunc, decodeFunc) {
            return function (decoder) {
                var len = lenFunc(decoder);
                return decodeFunc(decoder, len);
            };
        }

        function fix(len, method) {
            return function (decoder) {
                return method(decoder, len);
            };
        }


        /***/
    }),

    /***/ "./node_modules/msgpack-lite/lib/write-core.js":
    /*!*****************************************************!*\
  !*** ./node_modules/msgpack-lite/lib/write-core.js ***!
  \*****************************************************/
    /*! no static exports found */
    /***/ (function (module, exports, __webpack_require__) {

        // write-core.js

        var ExtBuffer = __webpack_require__(/*! ./ext-buffer */ "./node_modules/msgpack-lite/lib/ext-buffer.js").ExtBuffer;
        var ExtPacker = __webpack_require__(/*! ./ext-packer */ "./node_modules/msgpack-lite/lib/ext-packer.js");
        var WriteType = __webpack_require__(/*! ./write-type */ "./node_modules/msgpack-lite/lib/write-type.js");
        var CodecBase = __webpack_require__(/*! ./codec-base */ "./node_modules/msgpack-lite/lib/codec-base.js");

        CodecBase.install({
            addExtPacker: addExtPacker,
            getExtPacker: getExtPacker,
            init: init
        });

        exports.preset = init.call(CodecBase.preset);

        function getEncoder(options) {
            var writeType = WriteType.getWriteType(options);
            return encode;

            function encode(encoder, value) {
                var func = writeType[typeof value];
                if (!func) throw new Error("Unsupported type \"" + (typeof value) + "\": " + value);
                func(encoder, value);
            }
        }

        function init() {
            var options = this.options;
            this.encode = getEncoder(options);

            if (options && options.preset) {
                ExtPacker.setExtPackers(this);
            }

            return this;
        }

        function addExtPacker(etype, Class, packer) {
            packer = CodecBase.filter(packer);
            var name = Class.name;
            if (name && name !== "Object") {
                var packers = this.extPackers || (this.extPackers = {});
                packers[name] = extPacker;
            } else {
                // fallback for IE
                var list = this.extEncoderList || (this.extEncoderList = []);
                list.unshift([Class, extPacker]);
            }

            function extPacker(value) {
                if (packer) value = packer(value);
                return new ExtBuffer(value, etype);
            }
        }

        function getExtPacker(value) {
            var packers = this.extPackers || (this.extPackers = {});
            var c = value.constructor;
            var e = c && c.name && packers[c.name];
            if (e) return e;

            // fallback for IE
            var list = this.extEncoderList || (this.extEncoderList = []);
            var len = list.length;
            for (var i = 0; i < len; i++) {
                var pair = list[i];
                if (c === pair[0]) return pair[1];
            }
        }


        /***/
    }),

    /***/ "./node_modules/msgpack-lite/lib/write-token.js":
    /*!******************************************************!*\
  !*** ./node_modules/msgpack-lite/lib/write-token.js ***!
  \******************************************************/
    /*! no static exports found */
    /***/ (function (module, exports, __webpack_require__) {

        // write-token.js

        var ieee754 = __webpack_require__(/*! ieee754 */ "./node_modules/ieee754/index.js");
        var Int64Buffer = __webpack_require__(/*! int64-buffer */ "./node_modules/int64-buffer/int64-buffer.js");
        var Uint64BE = Int64Buffer.Uint64BE;
        var Int64BE = Int64Buffer.Int64BE;

        var uint8 = __webpack_require__(/*! ./write-uint8 */ "./node_modules/msgpack-lite/lib/write-uint8.js").uint8;
        var Bufferish = __webpack_require__(/*! ./bufferish */ "./node_modules/msgpack-lite/lib/bufferish.js");
        var Buffer = Bufferish.global;
        var IS_BUFFER_SHIM = Bufferish.hasBuffer && ("TYPED_ARRAY_SUPPORT" in Buffer);
        var NO_TYPED_ARRAY = IS_BUFFER_SHIM && !Buffer.TYPED_ARRAY_SUPPORT;
        var Buffer_prototype = Bufferish.hasBuffer && Buffer.prototype || {};

        exports.getWriteToken = getWriteToken;

        function getWriteToken(options) {
            if (options && options.uint8array) {
                return init_uint8array();
            } else if (NO_TYPED_ARRAY || (Bufferish.hasBuffer && options && options.safe)) {
                return init_safe();
            } else {
                return init_token();
            }
        }

        function init_uint8array() {
            var token = init_token();

            // float 32 -- 0xca
            // float 64 -- 0xcb
            token[0xca] = writeN(0xca, 4, writeFloatBE);
            token[0xcb] = writeN(0xcb, 8, writeDoubleBE);

            return token;
        }

        // Node.js and browsers with TypedArray

        function init_token() {
            // (immediate values)
            // positive fixint -- 0x00 - 0x7f
            // nil -- 0xc0
            // false -- 0xc2
            // true -- 0xc3
            // negative fixint -- 0xe0 - 0xff
            var token = uint8.slice();

            // bin 8 -- 0xc4
            // bin 16 -- 0xc5
            // bin 32 -- 0xc6
            token[0xc4] = write1(0xc4);
            token[0xc5] = write2(0xc5);
            token[0xc6] = write4(0xc6);

            // ext 8 -- 0xc7
            // ext 16 -- 0xc8
            // ext 32 -- 0xc9
            token[0xc7] = write1(0xc7);
            token[0xc8] = write2(0xc8);
            token[0xc9] = write4(0xc9);

            // float 32 -- 0xca
            // float 64 -- 0xcb
            token[0xca] = writeN(0xca, 4, (Buffer_prototype.writeFloatBE || writeFloatBE), true);
            token[0xcb] = writeN(0xcb, 8, (Buffer_prototype.writeDoubleBE || writeDoubleBE), true);

            // uint 8 -- 0xcc
            // uint 16 -- 0xcd
            // uint 32 -- 0xce
            // uint 64 -- 0xcf
            token[0xcc] = write1(0xcc);
            token[0xcd] = write2(0xcd);
            token[0xce] = write4(0xce);
            token[0xcf] = writeN(0xcf, 8, writeUInt64BE);

            // int 8 -- 0xd0
            // int 16 -- 0xd1
            // int 32 -- 0xd2
            // int 64 -- 0xd3
            token[0xd0] = write1(0xd0);
            token[0xd1] = write2(0xd1);
            token[0xd2] = write4(0xd2);
            token[0xd3] = writeN(0xd3, 8, writeInt64BE);

            // str 8 -- 0xd9
            // str 16 -- 0xda
            // str 32 -- 0xdb
            token[0xd9] = write1(0xd9);
            token[0xda] = write2(0xda);
            token[0xdb] = write4(0xdb);

            // array 16 -- 0xdc
            // array 32 -- 0xdd
            token[0xdc] = write2(0xdc);
            token[0xdd] = write4(0xdd);

            // map 16 -- 0xde
            // map 32 -- 0xdf
            token[0xde] = write2(0xde);
            token[0xdf] = write4(0xdf);

            return token;
        }

        // safe mode: for old browsers and who needs asserts

        function init_safe() {
            // (immediate values)
            // positive fixint -- 0x00 - 0x7f
            // nil -- 0xc0
            // false -- 0xc2
            // true -- 0xc3
            // negative fixint -- 0xe0 - 0xff
            var token = uint8.slice();

            // bin 8 -- 0xc4
            // bin 16 -- 0xc5
            // bin 32 -- 0xc6
            token[0xc4] = writeN(0xc4, 1, Buffer.prototype.writeUInt8);
            token[0xc5] = writeN(0xc5, 2, Buffer.prototype.writeUInt16BE);
            token[0xc6] = writeN(0xc6, 4, Buffer.prototype.writeUInt32BE);

            // ext 8 -- 0xc7
            // ext 16 -- 0xc8
            // ext 32 -- 0xc9
            token[0xc7] = writeN(0xc7, 1, Buffer.prototype.writeUInt8);
            token[0xc8] = writeN(0xc8, 2, Buffer.prototype.writeUInt16BE);
            token[0xc9] = writeN(0xc9, 4, Buffer.prototype.writeUInt32BE);

            // float 32 -- 0xca
            // float 64 -- 0xcb
            token[0xca] = writeN(0xca, 4, Buffer.prototype.writeFloatBE);
            token[0xcb] = writeN(0xcb, 8, Buffer.prototype.writeDoubleBE);

            // uint 8 -- 0xcc
            // uint 16 -- 0xcd
            // uint 32 -- 0xce
            // uint 64 -- 0xcf
            token[0xcc] = writeN(0xcc, 1, Buffer.prototype.writeUInt8);
            token[0xcd] = writeN(0xcd, 2, Buffer.prototype.writeUInt16BE);
            token[0xce] = writeN(0xce, 4, Buffer.prototype.writeUInt32BE);
            token[0xcf] = writeN(0xcf, 8, writeUInt64BE);

            // int 8 -- 0xd0
            // int 16 -- 0xd1
            // int 32 -- 0xd2
            // int 64 -- 0xd3
            token[0xd0] = writeN(0xd0, 1, Buffer.prototype.writeInt8);
            token[0xd1] = writeN(0xd1, 2, Buffer.prototype.writeInt16BE);
            token[0xd2] = writeN(0xd2, 4, Buffer.prototype.writeInt32BE);
            token[0xd3] = writeN(0xd3, 8, writeInt64BE);

            // str 8 -- 0xd9
            // str 16 -- 0xda
            // str 32 -- 0xdb
            token[0xd9] = writeN(0xd9, 1, Buffer.prototype.writeUInt8);
            token[0xda] = writeN(0xda, 2, Buffer.prototype.writeUInt16BE);
            token[0xdb] = writeN(0xdb, 4, Buffer.prototype.writeUInt32BE);

            // array 16 -- 0xdc
            // array 32 -- 0xdd
            token[0xdc] = writeN(0xdc, 2, Buffer.prototype.writeUInt16BE);
            token[0xdd] = writeN(0xdd, 4, Buffer.prototype.writeUInt32BE);

            // map 16 -- 0xde
            // map 32 -- 0xdf
            token[0xde] = writeN(0xde, 2, Buffer.prototype.writeUInt16BE);
            token[0xdf] = writeN(0xdf, 4, Buffer.prototype.writeUInt32BE);

            return token;
        }

        function write1(type) {
            return function (encoder, value) {
                var offset = encoder.reserve(2);
                var buffer = encoder.buffer;
                buffer[offset++] = type;
                buffer[offset] = value;
            };
        }

        function write2(type) {
            return function (encoder, value) {
                var offset = encoder.reserve(3);
                var buffer = encoder.buffer;
                buffer[offset++] = type;
                buffer[offset++] = value >>> 8;
                buffer[offset] = value;
            };
        }

        function write4(type) {
            return function (encoder, value) {
                var offset = encoder.reserve(5);
                var buffer = encoder.buffer;
                buffer[offset++] = type;
                buffer[offset++] = value >>> 24;
                buffer[offset++] = value >>> 16;
                buffer[offset++] = value >>> 8;
                buffer[offset] = value;
            };
        }

        function writeN(type, len, method, noAssert) {
            return function (encoder, value) {
                var offset = encoder.reserve(len + 1);
                encoder.buffer[offset++] = type;
                method.call(encoder.buffer, value, offset, noAssert);
            };
        }

        function writeUInt64BE(value, offset) {
            new Uint64BE(this, offset, value);
        }

        function writeInt64BE(value, offset) {
            new Int64BE(this, offset, value);
        }

        function writeFloatBE(value, offset) {
            ieee754.write(this, value, offset, false, 23, 4);
        }

        function writeDoubleBE(value, offset) {
            ieee754.write(this, value, offset, false, 52, 8);
        }


        /***/
    }),

    /***/ "./node_modules/msgpack-lite/lib/write-type.js":
    /*!*****************************************************!*\
  !*** ./node_modules/msgpack-lite/lib/write-type.js ***!
  \*****************************************************/
    /*! no static exports found */
    /***/ (function (module, exports, __webpack_require__) {

        // write-type.js

        var IS_ARRAY = __webpack_require__(/*! isarray */ "./node_modules/msgpack-lite/node_modules/isarray/index.js");
        var Int64Buffer = __webpack_require__(/*! int64-buffer */ "./node_modules/int64-buffer/int64-buffer.js");
        var Uint64BE = Int64Buffer.Uint64BE;
        var Int64BE = Int64Buffer.Int64BE;

        var Bufferish = __webpack_require__(/*! ./bufferish */ "./node_modules/msgpack-lite/lib/bufferish.js");
        var BufferProto = __webpack_require__(/*! ./bufferish-proto */ "./node_modules/msgpack-lite/lib/bufferish-proto.js");
        var WriteToken = __webpack_require__(/*! ./write-token */ "./node_modules/msgpack-lite/lib/write-token.js");
        var uint8 = __webpack_require__(/*! ./write-uint8 */ "./node_modules/msgpack-lite/lib/write-uint8.js").uint8;
        var ExtBuffer = __webpack_require__(/*! ./ext-buffer */ "./node_modules/msgpack-lite/lib/ext-buffer.js").ExtBuffer;

        var HAS_UINT8ARRAY = ("undefined" !== typeof Uint8Array);
        var HAS_MAP = ("undefined" !== typeof Map);

        var extmap = [];
        extmap[1] = 0xd4;
        extmap[2] = 0xd5;
        extmap[4] = 0xd6;
        extmap[8] = 0xd7;
        extmap[16] = 0xd8;

        exports.getWriteType = getWriteType;

        function getWriteType(options) {
            var token = WriteToken.getWriteToken(options);
            var useraw = options && options.useraw;
            var binarraybuffer = HAS_UINT8ARRAY && options && options.binarraybuffer;
            var isBuffer = binarraybuffer ? Bufferish.isArrayBuffer : Bufferish.isBuffer;
            var bin = binarraybuffer ? bin_arraybuffer : bin_buffer;
            var usemap = HAS_MAP && options && options.usemap;
            var map = usemap ? map_to_map : obj_to_map;

            var writeType = {
                "boolean": bool,
                "function": nil,
                "number": number,
                "object": (useraw ? object_raw : object),
                "string": _string(useraw ? raw_head_size : str_head_size),
                "symbol": nil,
                "undefined": nil
            };

            return writeType;

            // false -- 0xc2
            // true -- 0xc3
            function bool(encoder, value) {
                var type = value ? 0xc3 : 0xc2;
                token[type](encoder, value);
            }

            function number(encoder, value) {
                var ivalue = value | 0;
                var type;
                if (value !== ivalue) {
                    // float 64 -- 0xcb
                    type = 0xcb;
                    token[type](encoder, value);
                    return;
                } else if (-0x20 <= ivalue && ivalue <= 0x7F) {
                    // positive fixint -- 0x00 - 0x7f
                    // negative fixint -- 0xe0 - 0xff
                    type = ivalue & 0xFF;
                } else if (0 <= ivalue) {
                    // uint 8 -- 0xcc
                    // uint 16 -- 0xcd
                    // uint 32 -- 0xce
                    type = (ivalue <= 0xFF) ? 0xcc : (ivalue <= 0xFFFF) ? 0xcd : 0xce;
                } else {
                    // int 8 -- 0xd0
                    // int 16 -- 0xd1
                    // int 32 -- 0xd2
                    type = (-0x80 <= ivalue) ? 0xd0 : (-0x8000 <= ivalue) ? 0xd1 : 0xd2;
                }
                token[type](encoder, ivalue);
            }

            // uint 64 -- 0xcf
            function uint64(encoder, value) {
                var type = 0xcf;
                token[type](encoder, value.toArray());
            }

            // int 64 -- 0xd3
            function int64(encoder, value) {
                var type = 0xd3;
                token[type](encoder, value.toArray());
            }

            // str 8 -- 0xd9
            // str 16 -- 0xda
            // str 32 -- 0xdb
            // fixstr -- 0xa0 - 0xbf
            function str_head_size(length) {
                return (length < 32) ? 1 : (length <= 0xFF) ? 2 : (length <= 0xFFFF) ? 3 : 5;
            }

            // raw 16 -- 0xda
            // raw 32 -- 0xdb
            // fixraw -- 0xa0 - 0xbf
            function raw_head_size(length) {
                return (length < 32) ? 1 : (length <= 0xFFFF) ? 3 : 5;
            }

            function _string(head_size) {
                return string;

                function string(encoder, value) {
                    // prepare buffer
                    var length = value.length;
                    var maxsize = 5 + length * 3;
                    encoder.offset = encoder.reserve(maxsize);
                    var buffer = encoder.buffer;

                    // expected header size
                    var expected = head_size(length);

                    // expected start point
                    var start = encoder.offset + expected;

                    // write string
                    length = BufferProto.write.call(buffer, value, start);

                    // actual header size
                    var actual = head_size(length);

                    // move content when needed
                    if (expected !== actual) {
                        var targetStart = start + actual - expected;
                        var end = start + length;
                        BufferProto.copy.call(buffer, buffer, targetStart, start, end);
                    }

                    // write header
                    var type = (actual === 1) ? (0xa0 + length) : (actual <= 3) ? (0xd7 + actual) : 0xdb;
                    token[type](encoder, length);

                    // move cursor
                    encoder.offset += length;
                }
            }

            function object(encoder, value) {
                // null
                if (value === null) return nil(encoder, value);

                // Buffer
                if (isBuffer(value)) return bin(encoder, value);

                // Array
                if (IS_ARRAY(value)) return array(encoder, value);

                // int64-buffer objects
                if (Uint64BE.isUint64BE(value)) return uint64(encoder, value);
                if (Int64BE.isInt64BE(value)) return int64(encoder, value);

                // ext formats
                var packer = encoder.codec.getExtPacker(value);
                if (packer) value = packer(value);
                if (value instanceof ExtBuffer) return ext(encoder, value);

                // plain old Objects or Map
                map(encoder, value);
            }

            function object_raw(encoder, value) {
                // Buffer
                if (isBuffer(value)) return raw(encoder, value);

                // others
                object(encoder, value);
            }

            // nil -- 0xc0
            function nil(encoder, value) {
                var type = 0xc0;
                token[type](encoder, value);
            }

            // fixarray -- 0x90 - 0x9f
            // array 16 -- 0xdc
            // array 32 -- 0xdd
            function array(encoder, value) {
                var length = value.length;
                var type = (length < 16) ? (0x90 + length) : (length <= 0xFFFF) ? 0xdc : 0xdd;
                token[type](encoder, length);

                var encode = encoder.codec.encode;
                for (var i = 0; i < length; i++) {
                    encode(encoder, value[i]);
                }
            }

            // bin 8 -- 0xc4
            // bin 16 -- 0xc5
            // bin 32 -- 0xc6
            function bin_buffer(encoder, value) {
                var length = value.length;
                var type = (length < 0xFF) ? 0xc4 : (length <= 0xFFFF) ? 0xc5 : 0xc6;
                token[type](encoder, length);
                encoder.send(value);
            }

            function bin_arraybuffer(encoder, value) {
                bin_buffer(encoder, new Uint8Array(value));
            }

            // fixext 1 -- 0xd4
            // fixext 2 -- 0xd5
            // fixext 4 -- 0xd6
            // fixext 8 -- 0xd7
            // fixext 16 -- 0xd8
            // ext 8 -- 0xc7
            // ext 16 -- 0xc8
            // ext 32 -- 0xc9
            function ext(encoder, value) {
                var buffer = value.buffer;
                var length = buffer.length;
                var type = extmap[length] || ((length < 0xFF) ? 0xc7 : (length <= 0xFFFF) ? 0xc8 : 0xc9);
                token[type](encoder, length);
                uint8[value.type](encoder);
                encoder.send(buffer);
            }

            // fixmap -- 0x80 - 0x8f
            // map 16 -- 0xde
            // map 32 -- 0xdf
            function obj_to_map(encoder, value) {
                var keys = Object.keys(value);
                var length = keys.length;
                var type = (length < 16) ? (0x80 + length) : (length <= 0xFFFF) ? 0xde : 0xdf;
                token[type](encoder, length);

                var encode = encoder.codec.encode;
                keys.forEach(function (key) {
                    encode(encoder, key);
                    encode(encoder, value[key]);
                });
            }

            // fixmap -- 0x80 - 0x8f
            // map 16 -- 0xde
            // map 32 -- 0xdf
            function map_to_map(encoder, value) {
                if (!(value instanceof Map)) return obj_to_map(encoder, value);

                var length = value.size;
                var type = (length < 16) ? (0x80 + length) : (length <= 0xFFFF) ? 0xde : 0xdf;
                token[type](encoder, length);

                var encode = encoder.codec.encode;
                value.forEach(function (val, key, m) {
                    encode(encoder, key);
                    encode(encoder, val);
                });
            }

            // raw 16 -- 0xda
            // raw 32 -- 0xdb
            // fixraw -- 0xa0 - 0xbf
            function raw(encoder, value) {
                var length = value.length;
                var type = (length < 32) ? (0xa0 + length) : (length <= 0xFFFF) ? 0xda : 0xdb;
                token[type](encoder, length);
                encoder.send(value);
            }
        }


        /***/
    }),

    /***/ "./node_modules/msgpack-lite/lib/write-uint8.js":
    /*!******************************************************!*\
  !*** ./node_modules/msgpack-lite/lib/write-uint8.js ***!
  \******************************************************/
    /*! no static exports found */
    /***/ (function (module, exports) {

        // write-unit8.js

        var constant = exports.uint8 = new Array(256);

        for (var i = 0x00; i <= 0xFF; i++) {
            constant[i] = write0(i);
        }

        function write0(type) {
            return function (encoder) {
                var offset = encoder.reserve(1);
                encoder.buffer[offset] = type;
            };
        }


        /***/
    }),

    /***/ "./node_modules/msgpack-lite/node_modules/isarray/index.js":
    /*!*****************************************************************!*\
  !*** ./node_modules/msgpack-lite/node_modules/isarray/index.js ***!
  \*****************************************************************/
    /*! no static exports found */
    /***/ (function (module, exports) {

        var toString = {}.toString;

        module.exports = Array.isArray || function (arr) {
            return toString.call(arr) == '[object Array]';
        };


        /***/
    }),

    /***/ "./node_modules/process/browser.js":
    /*!*****************************************!*\
  !*** ./node_modules/process/browser.js ***!
  \*****************************************/
    /*! no static exports found */
    /***/ (function (module, exports) {

        // shim for using process in browser
        var process = module.exports = {};

        // cached from whatever global is present so that test runners that stub it
        // don't break things.  But we need to wrap it in a try catch in case it is
        // wrapped in strict mode code which doesn't define any globals.  It's inside a
        // function because try/catches deoptimize in certain engines.

        var cachedSetTimeout;
        var cachedClearTimeout;

        function defaultSetTimout() {
            throw new Error('setTimeout has not been defined');
        }
        function defaultClearTimeout() {
            throw new Error('clearTimeout has not been defined');
        }
        (function () {
            try {
                if (typeof setTimeout === 'function') {
                    cachedSetTimeout = setTimeout;
                } else {
                    cachedSetTimeout = defaultSetTimout;
                }
            } catch (e) {
                cachedSetTimeout = defaultSetTimout;
            }
            try {
                if (typeof clearTimeout === 'function') {
                    cachedClearTimeout = clearTimeout;
                } else {
                    cachedClearTimeout = defaultClearTimeout;
                }
            } catch (e) {
                cachedClearTimeout = defaultClearTimeout;
            }
        }())
        function runTimeout(fun) {
            if (cachedSetTimeout === setTimeout) {
                //normal enviroments in sane situations
                return setTimeout(fun, 0);
            }
            // if setTimeout wasn't available but was latter defined
            if ((cachedSetTimeout === defaultSetTimout || !cachedSetTimeout) && setTimeout) {
                cachedSetTimeout = setTimeout;
                return setTimeout(fun, 0);
            }
            try {
                // when when somebody has screwed with setTimeout but no I.E. maddness
                return cachedSetTimeout(fun, 0);
            } catch (e) {
                try {
                    // When we are in I.E. but the script has been evaled so I.E. doesn't trust the global object when called normally
                    return cachedSetTimeout.call(null, fun, 0);
                } catch (e) {
                    // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error
                    return cachedSetTimeout.call(this, fun, 0);
                }
            }


        }
        function runClearTimeout(marker) {
            if (cachedClearTimeout === clearTimeout) {
                //normal enviroments in sane situations
                return clearTimeout(marker);
            }
            // if clearTimeout wasn't available but was latter defined
            if ((cachedClearTimeout === defaultClearTimeout || !cachedClearTimeout) && clearTimeout) {
                cachedClearTimeout = clearTimeout;
                return clearTimeout(marker);
            }
            try {
                // when when somebody has screwed with setTimeout but no I.E. maddness
                return cachedClearTimeout(marker);
            } catch (e) {
                try {
                    // When we are in I.E. but the script has been evaled so I.E. doesn't  trust the global object when called normally
                    return cachedClearTimeout.call(null, marker);
                } catch (e) {
                    // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error.
                    // Some versions of I.E. have different rules for clearTimeout vs setTimeout
                    return cachedClearTimeout.call(this, marker);
                }
            }



        }
        var queue = [];
        var draining = false;
        var currentQueue;
        var queueIndex = -1;

        function cleanUpNextTick() {
            if (!draining || !currentQueue) {
                return;
            }
            draining = false;
            if (currentQueue.length) {
                queue = currentQueue.concat(queue);
            } else {
                queueIndex = -1;
            }
            if (queue.length) {
                drainQueue();
            }
        }

        function drainQueue() {
            if (draining) {
                return;
            }
            var timeout = runTimeout(cleanUpNextTick);
            draining = true;

            var len = queue.length;
            while (len) {
                currentQueue = queue;
                queue = [];
                while (++queueIndex < len) {
                    if (currentQueue) {
                        currentQueue[queueIndex].run();
                    }
                }
                queueIndex = -1;
                len = queue.length;
            }
            currentQueue = null;
            draining = false;
            runClearTimeout(timeout);
        }

        process.nextTick = function (fun) {
            var args = new Array(arguments.length - 1);
            if (arguments.length > 1) {
                for (var i = 1; i < arguments.length; i++) {
                    args[i - 1] = arguments[i];
                }
            }
            queue.push(new Item(fun, args));
            if (queue.length === 1 && !draining) {
                runTimeout(drainQueue);
            }
        };

        // v8 likes predictible objects
        function Item(fun, array) {
            this.fun = fun;
            this.array = array;
        }
        Item.prototype.run = function () {
            this.fun.apply(null, this.array);
        };
        process.title = 'browser';
        process.browser = true;
        process.env = {};
        process.argv = [];
        process.version = ''; // empty string to avoid regexp issues
        process.versions = {};

        function noop() { }

        process.on = noop;
        process.addListener = noop;
        process.once = noop;
        process.off = noop;
        process.removeListener = noop;
        process.removeAllListeners = noop;
        process.emit = noop;
        process.prependListener = noop;
        process.prependOnceListener = noop;

        process.listeners = function (name) { return [] }

        process.binding = function (name) {
            throw new Error('process.binding is not supported');
        };

        process.cwd = function () { return '/' };
        process.chdir = function (dir) {
            throw new Error('process.chdir is not supported');
        };
        process.umask = function () { return 0; };


        /***/
    }),

    /***/ "./node_modules/punycode/punycode.js":
    /*!*******************************************!*\
  !*** ./node_modules/punycode/punycode.js ***!
  \*******************************************/
    /*! no static exports found */
    /***/ (function (module, exports, __webpack_require__) {

        /* WEBPACK VAR INJECTION */(function (module, global) {
            var __WEBPACK_AMD_DEFINE_RESULT__;/*! https://mths.be/punycode v1.4.1 by @mathias */
            ; (function (root) {

                /** Detect free variables */
                var freeExports = true && exports &&
                    !exports.nodeType && exports;
                var freeModule = true && module &&
                    !module.nodeType && module;
                var freeGlobal = typeof global == 'object' && global;
                if (
                    freeGlobal.global === freeGlobal ||
                    freeGlobal.window === freeGlobal ||
                    freeGlobal.self === freeGlobal
                ) {
                    root = freeGlobal;
                }

                /**
* The `punycode` object.
* @name punycode
* @type Object
*/
                var punycode,

                    /** Highest positive signed 32-bit float value */
                    maxInt = 2147483647, // aka. 0x7FFFFFFF or 2^31-1

                    /** Bootstring parameters */
                    base = 36,
                    tMin = 1,
                    tMax = 26,
                    skew = 38,
                    damp = 700,
                    initialBias = 72,
                    initialN = 128, // 0x80
                    delimiter = '-', // '\x2D'

                    /** Regular expressions */
                    regexPunycode = /^xn--/,
                    regexNonASCII = /[^\x20-\x7E]/, // unprintable ASCII chars + non-ASCII chars
                    regexSeparators = /[\x2E\u3002\uFF0E\uFF61]/g, // RFC 3490 separators

                    /** Error messages */
                    errors = {
                        'overflow': 'Overflow: input needs wider integers to process',
                        'not-basic': 'Illegal input >= 0x80 (not a basic code point)',
                        'invalid-input': 'Invalid input'
                    },

                    /** Convenience shortcuts */
                    baseMinusTMin = base - tMin,
                    floor = Math.floor,
                    stringFromCharCode = String.fromCharCode,

                    /** Temporary variable */
                    key;

                /*--------------------------------------------------------------------------*/

                /**
* A generic error utility function.
* @private
* @param {String} type The error type.
* @returns {Error} Throws a `RangeError` with the applicable error message.
*/
                function error(type) {
                    throw new RangeError(errors[type]);
                }

                /**
* A generic `Array#map` utility function.
* @private
* @param {Array} array The array to iterate over.
* @param {Function} callback The function that gets called for every array
* item.
* @returns {Array} A new array of values returned by the callback function.
*/
                function map(array, fn) {
                    var length = array.length;
                    var result = [];
                    while (length--) {
                        result[length] = fn(array[length]);
                    }
                    return result;
                }

                /**
* A simple `Array#map`-like wrapper to work with domain name strings or email
* addresses.
* @private
* @param {String} domain The domain name or email address.
* @param {Function} callback The function that gets called for every
* character.
* @returns {Array} A new string of characters returned by the callback
* function.
*/
                function mapDomain(string, fn) {
                    var parts = string.split('@');
                    var result = '';
                    if (parts.length > 1) {
                        // In email addresses, only the domain name should be punycoded. Leave
                        // the local part (i.e. everything up to `@`) intact.
                        result = parts[0] + '@';
                        string = parts[1];
                    }
                    // Avoid `split(regex)` for IE8 compatibility. See #17.
                    string = string.replace(regexSeparators, '\x2E');
                    var labels = string.split('.');
                    var encoded = map(labels, fn).join('.');
                    return result + encoded;
                }

                /**
* Creates an array containing the numeric code points of each Unicode
* character in the string. While JavaScript uses UCS-2 internally,
* this function will convert a pair of surrogate halves (each of which
* UCS-2 exposes as separate characters) into a single code point,
* matching UTF-16.
* @see `punycode.ucs2.encode`
* @see <https://mathiasbynens.be/notes/javascript-encoding>
* @memberOf punycode.ucs2
* @name decode
* @param {String} string The Unicode input string (UCS-2).
* @returns {Array} The new array of code points.
*/
                function ucs2decode(string) {
                    var output = [],
                        counter = 0,
                        length = string.length,
                        value,
                        extra;
                    while (counter < length) {
                        value = string.charCodeAt(counter++);
                        if (value >= 0xD800 && value <= 0xDBFF && counter < length) {
                            // high surrogate, and there is a next character
                            extra = string.charCodeAt(counter++);
                            if ((extra & 0xFC00) == 0xDC00) { // low surrogate
                                output.push(((value & 0x3FF) << 10) + (extra & 0x3FF) + 0x10000);
                            } else {
                                // unmatched surrogate; only append this code unit, in case the next
                                // code unit is the high surrogate of a surrogate pair
                                output.push(value);
                                counter--;
                            }
                        } else {
                            output.push(value);
                        }
                    }
                    return output;
                }

                /**
* Creates a string based on an array of numeric code points.
* @see `punycode.ucs2.decode`
* @memberOf punycode.ucs2
* @name encode
* @param {Array} codePoints The array of numeric code points.
* @returns {String} The new Unicode string (UCS-2).
*/
                function ucs2encode(array) {
                    return map(array, function (value) {
                        var output = '';
                        if (value > 0xFFFF) {
                            value -= 0x10000;
                            output += stringFromCharCode(value >>> 10 & 0x3FF | 0xD800);
                            value = 0xDC00 | value & 0x3FF;
                        }
                        output += stringFromCharCode(value);
                        return output;
                    }).join('');
                }

                /**
* Converts a basic code point into a digit/integer.
* @see `digitToBasic()`
* @private
* @param {Number} codePoint The basic numeric code point value.
* @returns {Number} The numeric value of a basic code point (for use in
* representing integers) in the range `0` to `base - 1`, or `base` if
* the code point does not represent a value.
*/
                function basicToDigit(codePoint) {
                    if (codePoint - 48 < 10) {
                        return codePoint - 22;
                    }
                    if (codePoint - 65 < 26) {
                        return codePoint - 65;
                    }
                    if (codePoint - 97 < 26) {
                        return codePoint - 97;
                    }
                    return base;
                }

                /**
* Converts a digit/integer into a basic code point.
* @see `basicToDigit()`
* @private
* @param {Number} digit The numeric value of a basic code point.
* @returns {Number} The basic code point whose value (when used for
* representing integers) is `digit`, which needs to be in the range
* `0` to `base - 1`. If `flag` is non-zero, the uppercase form is
* used; else, the lowercase form is used. The behavior is undefined
* if `flag` is non-zero and `digit` has no uppercase form.
*/
                function digitToBasic(digit, flag) {
                    //  0..25 map to ASCII a..z or A..Z
                    // 26..35 map to ASCII 0..9
                    return digit + 22 + 75 * (digit < 26) - ((flag != 0) << 5);
                }

                /**
* Bias adaptation function as per section 3.4 of RFC 3492.
* https://tools.ietf.org/html/rfc3492#section-3.4
* @private
*/
                function adapt(delta, numPoints, firstTime) {
                    var k = 0;
                    delta = firstTime ? floor(delta / damp) : delta >> 1;
                    delta += floor(delta / numPoints);
                    for (/* no initialization */; delta > baseMinusTMin * tMax >> 1; k += base) {
                        delta = floor(delta / baseMinusTMin);
                    }
                    return floor(k + (baseMinusTMin + 1) * delta / (delta + skew));
                }

                /**
* Converts a Punycode string of ASCII-only symbols to a string of Unicode
* symbols.
* @memberOf punycode
* @param {String} input The Punycode string of ASCII-only symbols.
* @returns {String} The resulting string of Unicode symbols.
*/
                function decode(input) {
                    // Don't use UCS-2
                    var output = [],
                        inputLength = input.length,
                        out,
                        i = 0,
                        n = initialN,
                        bias = initialBias,
                        basic,
                        j,
                        index,
                        oldi,
                        w,
                        k,
                        digit,
                        t,
                        /** Cached calculation results */
                        baseMinusT;

                    // Handle the basic code points: let `basic` be the number of input code
                    // points before the last delimiter, or `0` if there is none, then copy
                    // the first basic code points to the output.

                    basic = input.lastIndexOf(delimiter);
                    if (basic < 0) {
                        basic = 0;
                    }

                    for (j = 0; j < basic; ++j) {
                        // if it's not a basic code point
                        if (input.charCodeAt(j) >= 0x80) {
                            error('not-basic');
                        }
                        output.push(input.charCodeAt(j));
                    }

                    // Main decoding loop: start just after the last delimiter if any basic code
                    // points were copied; start at the beginning otherwise.

                    for (index = basic > 0 ? basic + 1 : 0; index < inputLength; /* no final expression */) {

                        // `index` is the index of the next character to be consumed.
                        // Decode a generalized variable-length integer into `delta`,
                        // which gets added to `i`. The overflow checking is easier
                        // if we increase `i` as we go, then subtract off its starting
                        // value at the end to obtain `delta`.
                        for (oldi = i, w = 1, k = base; /* no condition */; k += base) {

                            if (index >= inputLength) {
                                error('invalid-input');
                            }

                            digit = basicToDigit(input.charCodeAt(index++));

                            if (digit >= base || digit > floor((maxInt - i) / w)) {
                                error('overflow');
                            }

                            i += digit * w;
                            t = k <= bias ? tMin : (k >= bias + tMax ? tMax : k - bias);

                            if (digit < t) {
                                break;
                            }

                            baseMinusT = base - t;
                            if (w > floor(maxInt / baseMinusT)) {
                                error('overflow');
                            }

                            w *= baseMinusT;

                        }

                        out = output.length + 1;
                        bias = adapt(i - oldi, out, oldi == 0);

                        // `i` was supposed to wrap around from `out` to `0`,
                        // incrementing `n` each time, so we'll fix that now:
                        if (floor(i / out) > maxInt - n) {
                            error('overflow');
                        }

                        n += floor(i / out);
                        i %= out;

                        // Insert `n` at position `i` of the output
                        output.splice(i++, 0, n);

                    }

                    return ucs2encode(output);
                }

                /**
* Converts a string of Unicode symbols (e.g. a domain name label) to a
* Punycode string of ASCII-only symbols.
* @memberOf punycode
* @param {String} input The string of Unicode symbols.
* @returns {String} The resulting Punycode string of ASCII-only symbols.
*/
                function encode(input) {
                    var n,
                        delta,
                        handledCPCount,
                        basicLength,
                        bias,
                        j,
                        m,
                        q,
                        k,
                        t,
                        currentValue,
                        output = [],
                        /** `inputLength` will hold the number of code points in `input`. */
                        inputLength,
                        /** Cached calculation results */
                        handledCPCountPlusOne,
                        baseMinusT,
                        qMinusT;

                    // Convert the input in UCS-2 to Unicode
                    input = ucs2decode(input);

                    // Cache the length
                    inputLength = input.length;

                    // Initialize the state
                    n = initialN;
                    delta = 0;
                    bias = initialBias;

                    // Handle the basic code points
                    for (j = 0; j < inputLength; ++j) {
                        currentValue = input[j];
                        if (currentValue < 0x80) {
                            output.push(stringFromCharCode(currentValue));
                        }
                    }

                    handledCPCount = basicLength = output.length;

                    // `handledCPCount` is the number of code points that have been handled;
                    // `basicLength` is the number of basic code points.

                    // Finish the basic string - if it is not empty - with a delimiter
                    if (basicLength) {
                        output.push(delimiter);
                    }

                    // Main encoding loop:
                    while (handledCPCount < inputLength) {

                        // All non-basic code points < n have been handled already. Find the next
                        // larger one:
                        for (m = maxInt, j = 0; j < inputLength; ++j) {
                            currentValue = input[j];
                            if (currentValue >= n && currentValue < m) {
                                m = currentValue;
                            }
                        }

                        // Increase `delta` enough to advance the decoder's <n,i> state to <m,0>,
                        // but guard against overflow
                        handledCPCountPlusOne = handledCPCount + 1;
                        if (m - n > floor((maxInt - delta) / handledCPCountPlusOne)) {
                            error('overflow');
                        }

                        delta += (m - n) * handledCPCountPlusOne;
                        n = m;

                        for (j = 0; j < inputLength; ++j) {
                            currentValue = input[j];

                            if (currentValue < n && ++delta > maxInt) {
                                error('overflow');
                            }

                            if (currentValue == n) {
                                // Represent delta as a generalized variable-length integer
                                for (q = delta, k = base; /* no condition */; k += base) {
                                    t = k <= bias ? tMin : (k >= bias + tMax ? tMax : k - bias);
                                    if (q < t) {
                                        break;
                                    }
                                    qMinusT = q - t;
                                    baseMinusT = base - t;
                                    output.push(
                                        stringFromCharCode(digitToBasic(t + qMinusT % baseMinusT, 0))
                                    );
                                    q = floor(qMinusT / baseMinusT);
                                }

                                output.push(stringFromCharCode(digitToBasic(q, 0)));
                                bias = adapt(delta, handledCPCountPlusOne, handledCPCount == basicLength);
                                delta = 0;
                                ++handledCPCount;
                            }
                        }

                        ++delta;
                        ++n;

                    }
                    return output.join('');
                }

                /**
* Converts a Punycode string representing a domain name or an email address
* to Unicode. Only the Punycoded parts of the input will be converted, i.e.
* it doesn't matter if you call it on a string that has already been
* converted to Unicode.
* @memberOf punycode
* @param {String} input The Punycoded domain name or email address to
* convert to Unicode.
* @returns {String} The Unicode representation of the given Punycode
* string.
*/
                function toUnicode(input) {
                    return mapDomain(input, function (string) {
                        return regexPunycode.test(string)
                            ? decode(string.slice(4).toLowerCase())
                        : string;
                    });
                }

                /**
* Converts a Unicode string representing a domain name or an email address to
* Punycode. Only the non-ASCII parts of the domain name will be converted,
* i.e. it doesn't matter if you call it with a domain that's already in
* ASCII.
* @memberOf punycode
* @param {String} input The domain name or email address to convert, as a
* Unicode string.
* @returns {String} The Punycode representation of the given domain name or
* email address.
*/
                function toASCII(input) {
                    return mapDomain(input, function (string) {
                        return regexNonASCII.test(string)
                            ? 'xn--' + encode(string)
                        : string;
                    });
                }

                /*--------------------------------------------------------------------------*/

                /** Define the public API */
                punycode = {
                    /**
* A string representing the current Punycode.js version number.
* @memberOf punycode
* @type String
*/
                    'version': '1.4.1',
                    /**
* An object of methods to convert from JavaScript's internal character
* representation (UCS-2) to Unicode code points, and back.
* @see <https://mathiasbynens.be/notes/javascript-encoding>
* @memberOf punycode
* @type Object
*/
                    'ucs2': {
                        'decode': ucs2decode,
                        'encode': ucs2encode
                    },
                    'decode': decode,
                    'encode': encode,
                    'toASCII': toASCII,
                    'toUnicode': toUnicode
                };

                /** Expose `punycode` */
                // Some AMD build optimizers, like r.js, check for specific condition patterns
                // like the following:
                if (
                    true
                ) {
                    !(__WEBPACK_AMD_DEFINE_RESULT__ = (function () {
                        return punycode;
                    }).call(exports, __webpack_require__, exports, module),
                      __WEBPACK_AMD_DEFINE_RESULT__ !== undefined && (module.exports = __WEBPACK_AMD_DEFINE_RESULT__));
                } else { }

            }(this));

            /* WEBPACK VAR INJECTION */
        }.call(this, __webpack_require__(/*! ./../webpack/buildin/module.js */ "./node_modules/webpack/buildin/module.js")(module), __webpack_require__(/*! ./../webpack/buildin/global.js */ "./node_modules/webpack/buildin/global.js")))

        /***/
    }),

    /***/ "./node_modules/querystring-es3/decode.js":
    /*!************************************************!*\
  !*** ./node_modules/querystring-es3/decode.js ***!
  \************************************************/
    /*! no static exports found */
    /***/ (function (module, exports, __webpack_require__) {

        "use strict";
        // Copyright Joyent, Inc. and other Node contributors.
        //
        // Permission is hereby granted, free of charge, to any person obtaining a
        // copy of this software and associated documentation files (the
        // "Software"), to deal in the Software without restriction, including
        // without limitation the rights to use, copy, modify, merge, publish,
        // distribute, sublicense, and/or sell copies of the Software, and to permit
        // persons to whom the Software is furnished to do so, subject to the
        // following conditions:
        //
        // The above copyright notice and this permission notice shall be included
        // in all copies or substantial portions of the Software.
        //
        // THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
        // OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
        // MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
        // NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
        // DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
        // OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
        // USE OR OTHER DEALINGS IN THE SOFTWARE.



        // If obj.hasOwnProperty has been overridden, then calling
        // obj.hasOwnProperty(prop) will break.
        // See: https://github.com/joyent/node/issues/1707
        function hasOwnProperty(obj, prop) {
            return Object.prototype.hasOwnProperty.call(obj, prop);
        }

        module.exports = function (qs, sep, eq, options) {
            sep = sep || '&';
            eq = eq || '=';
            var obj = {};

            if (typeof qs !== 'string' || qs.length === 0) {
                return obj;
            }

            var regexp = /\+/g;
            qs = qs.split(sep);

            var maxKeys = 1000;
            if (options && typeof options.maxKeys === 'number') {
                maxKeys = options.maxKeys;
            }

            var len = qs.length;
            // maxKeys <= 0 means that we should not limit keys count
            if (maxKeys > 0 && len > maxKeys) {
                len = maxKeys;
            }

            for (var i = 0; i < len; ++i) {
                var x = qs[i].replace(regexp, '%20'),
                    idx = x.indexOf(eq),
                    kstr, vstr, k, v;

                if (idx >= 0) {
                    kstr = x.substr(0, idx);
                    vstr = x.substr(idx + 1);
                } else {
                    kstr = x;
                    vstr = '';
                }

                k = decodeURIComponent(kstr);
                v = decodeURIComponent(vstr);

                if (!hasOwnProperty(obj, k)) {
                    obj[k] = v;
                } else if (isArray(obj[k])) {
                    obj[k].push(v);
                } else {
                    obj[k] = [obj[k], v];
                }
            }

            return obj;
        };

        var isArray = Array.isArray || function (xs) {
            return Object.prototype.toString.call(xs) === '[object Array]';
        };


        /***/
    }),

    /***/ "./node_modules/querystring-es3/encode.js":
    /*!************************************************!*\
  !*** ./node_modules/querystring-es3/encode.js ***!
  \************************************************/
    /*! no static exports found */
    /***/ (function (module, exports, __webpack_require__) {

        "use strict";
        // Copyright Joyent, Inc. and other Node contributors.
        //
        // Permission is hereby granted, free of charge, to any person obtaining a
        // copy of this software and associated documentation files (the
        // "Software"), to deal in the Software without restriction, including
        // without limitation the rights to use, copy, modify, merge, publish,
        // distribute, sublicense, and/or sell copies of the Software, and to permit
        // persons to whom the Software is furnished to do so, subject to the
        // following conditions:
        //
        // The above copyright notice and this permission notice shall be included
        // in all copies or substantial portions of the Software.
        //
        // THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
        // OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
        // MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
        // NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
        // DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
        // OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
        // USE OR OTHER DEALINGS IN THE SOFTWARE.



        var stringifyPrimitive = function (v) {
            switch (typeof v) {
                case 'string':
                    return v;

                case 'boolean':
                    return v ? 'true' : 'false';

                case 'number':
                    return isFinite(v) ? v : '';

                default:
                    return '';
            }
        };

        module.exports = function (obj, sep, eq, name) {
            sep = sep || '&';
            eq = eq || '=';
            if (obj === null) {
                obj = undefined;
            }

            if (typeof obj === 'object') {
                return map(objectKeys(obj), function (k) {
                    var ks = encodeURIComponent(stringifyPrimitive(k)) + eq;
                    if (isArray(obj[k])) {
                        return map(obj[k], function (v) {
                            return ks + encodeURIComponent(stringifyPrimitive(v));
                        }).join(sep);
                    } else {
                        return ks + encodeURIComponent(stringifyPrimitive(obj[k]));
                    }
                }).join(sep);

            }

            if (!name) return '';
            return encodeURIComponent(stringifyPrimitive(name)) + eq +
                encodeURIComponent(stringifyPrimitive(obj));
        };

        var isArray = Array.isArray || function (xs) {
            return Object.prototype.toString.call(xs) === '[object Array]';
        };

        function map(xs, f) {
            if (xs.map) return xs.map(f);
            var res = [];
            for (var i = 0; i < xs.length; i++) {
                res.push(f(xs[i], i));
            }
            return res;
        }

        var objectKeys = Object.keys || function (obj) {
            var res = [];
            for (var key in obj) {
                if (Object.prototype.hasOwnProperty.call(obj, key)) res.push(key);
            }
            return res;
        };


        /***/
    }),

    /***/ "./node_modules/querystring-es3/index.js":
    /*!***********************************************!*\
  !*** ./node_modules/querystring-es3/index.js ***!
  \***********************************************/
    /*! no static exports found */
    /***/ (function (module, exports, __webpack_require__) {

        "use strict";


        exports.decode = exports.parse = __webpack_require__(/*! ./decode */ "./node_modules/querystring-es3/decode.js");
        exports.encode = exports.stringify = __webpack_require__(/*! ./encode */ "./node_modules/querystring-es3/encode.js");


        /***/
    }),

    /***/ "./node_modules/url/url.js":
    /*!*********************************!*\
  !*** ./node_modules/url/url.js ***!
  \*********************************/
    /*! no static exports found */
    /***/ (function (module, exports, __webpack_require__) {

        "use strict";
        // Copyright Joyent, Inc. and other Node contributors.
        //
        // Permission is hereby granted, free of charge, to any person obtaining a
        // copy of this software and associated documentation files (the
        // "Software"), to deal in the Software without restriction, including
        // without limitation the rights to use, copy, modify, merge, publish,
        // distribute, sublicense, and/or sell copies of the Software, and to permit
        // persons to whom the Software is furnished to do so, subject to the
        // following conditions:
        //
        // The above copyright notice and this permission notice shall be included
        // in all copies or substantial portions of the Software.
        //
        // THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
        // OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
        // MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
        // NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
        // DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
        // OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
        // USE OR OTHER DEALINGS IN THE SOFTWARE.



        var punycode = __webpack_require__(/*! punycode */ "./node_modules/punycode/punycode.js");
        var util = __webpack_require__(/*! ./util */ "./node_modules/url/util.js");

        exports.parse = urlParse;
        exports.resolve = urlResolve;
        exports.resolveObject = urlResolveObject;
        exports.format = urlFormat;

        exports.Url = Url;

        function Url() {
            this.protocol = null;
            this.slashes = null;
            this.auth = null;
            this.host = null;
            this.port = null;
            this.hostname = null;
            this.hash = null;
            this.search = null;
            this.query = null;
            this.pathname = null;
            this.path = null;
            this.href = null;
        }

        // Reference: RFC 3986, RFC 1808, RFC 2396

        // define these here so at least they only have to be
        // compiled once on the first module load.
        var protocolPattern = /^([a-z0-9.+-]+:)/i,
            portPattern = /:[0-9]*$/,

            // Special case for a simple path URL
            simplePathPattern = /^(\/\/?(?!\/)[^\?\s]*)(\?[^\s]*)?$/,

            // RFC 2396: characters reserved for delimiting URLs.
            // We actually just auto-escape these.
            delims = ['<', '>', '"', '`', ' ', '\r', '\n', '\t'],

            // RFC 2396: characters not allowed for various reasons.
            unwise = ['{', '}', '|', '\\', '^', '`'].concat(delims),

            // Allowed by RFCs, but cause of XSS attacks.  Always escape these.
            autoEscape = ['\''].concat(unwise),
            // Characters that are never ever allowed in a hostname.
            // Note that any invalid chars are also handled, but these
            // are the ones that are *expected* to be seen, so we fast-path
            // them.
            nonHostChars = ['%', '/', '?', ';', '#'].concat(autoEscape),
            hostEndingChars = ['/', '?', '#'],
            hostnameMaxLen = 255,
            hostnamePartPattern = /^[+a-z0-9A-Z_-]{0,63}$/,
            hostnamePartStart = /^([+a-z0-9A-Z_-]{0,63})(.*)$/,
            // protocols that can allow "unsafe" and "unwise" chars.
            unsafeProtocol = {
                'javascript': true,
                'javascript:': true
            },
            // protocols that never have a hostname.
            hostlessProtocol = {
                'javascript': true,
                'javascript:': true
            },
            // protocols that always contain a // bit.
            slashedProtocol = {
                'http': true,
                'https': true,
                'ftp': true,
                'gopher': true,
                'file': true,
                'http:': true,
                'https:': true,
                'ftp:': true,
                'gopher:': true,
                'file:': true
            },
            querystring = __webpack_require__(/*! querystring */ "./node_modules/querystring-es3/index.js");

        function urlParse(url, parseQueryString, slashesDenoteHost) {
            if (url && util.isObject(url) && url instanceof Url) return url;

            var u = new Url;
            u.parse(url, parseQueryString, slashesDenoteHost);
            return u;
        }

        Url.prototype.parse = function (url, parseQueryString, slashesDenoteHost) {
            if (!util.isString(url)) {
                throw new TypeError("Parameter 'url' must be a string, not " + typeof url);
            }

            // Copy chrome, IE, opera backslash-handling behavior.
            // Back slashes before the query string get converted to forward slashes
            // See: https://code.google.com/p/chromium/issues/detail?id=25916
            var queryIndex = url.indexOf('?'),
                splitter =
                (queryIndex !== -1 && queryIndex < url.indexOf('#')) ? '?' : '#',
                uSplit = url.split(splitter),
                slashRegex = /\\/g;
            uSplit[0] = uSplit[0].replace(slashRegex, '/');
            url = uSplit.join(splitter);

            var rest = url;

            // trim before proceeding.
            // This is to support parse stuff like "  http://foo.com  \n"
            rest = rest.trim();

            if (!slashesDenoteHost && url.split('#').length === 1) {
                // Try fast path regexp
                var simplePath = simplePathPattern.exec(rest);
                if (simplePath) {
                    this.path = rest;
                    this.href = rest;
                    this.pathname = simplePath[1];
                    if (simplePath[2]) {
                        this.search = simplePath[2];
                        if (parseQueryString) {
                            this.query = querystring.parse(this.search.substr(1));
                        } else {
                            this.query = this.search.substr(1);
                        }
                    } else if (parseQueryString) {
                        this.search = '';
                        this.query = {};
                    }
                    return this;
                }
            }

            var proto = protocolPattern.exec(rest);
            if (proto) {
                proto = proto[0];
                var lowerProto = proto.toLowerCase();
                this.protocol = lowerProto;
                rest = rest.substr(proto.length);
            }

            // figure out if it's got a host
            // user@server is *always* interpreted as a hostname, and url
            // resolution will treat //foo/bar as host=foo,path=bar because that's
            // how the browser resolves relative URLs.
            if (slashesDenoteHost || proto || rest.match(/^\/\/[^@\/]+@[^@\/]+/)) {
                var slashes = rest.substr(0, 2) === '//';
                if (slashes && !(proto && hostlessProtocol[proto])) {
                    rest = rest.substr(2);
                    this.slashes = true;
                }
            }

            if (!hostlessProtocol[proto] &&
                (slashes || (proto && !slashedProtocol[proto]))) {

                // there's a hostname.
                // the first instance of /, ?, ;, or # ends the host.
                //
                // If there is an @ in the hostname, then non-host chars *are* allowed
                // to the left of the last @ sign, unless some host-ending character
                // comes *before* the @-sign.
                // URLs are obnoxious.
                //
                // ex:
                // http://a@b@c/ => user:a@b host:c
                // http://a@b?@c => user:a host:c path:/?@c

                // v0.12 TODO(isaacs): This is not quite how Chrome does things.
                // Review our test case against browsers more comprehensively.

                // find the first instance of any hostEndingChars
                var hostEnd = -1;
                for (var i = 0; i < hostEndingChars.length; i++) {
                    var hec = rest.indexOf(hostEndingChars[i]);
                    if (hec !== -1 && (hostEnd === -1 || hec < hostEnd))
                        hostEnd = hec;
                }

                // at this point, either we have an explicit point where the
                // auth portion cannot go past, or the last @ char is the decider.
                var auth, atSign;
                if (hostEnd === -1) {
                    // atSign can be anywhere.
                    atSign = rest.lastIndexOf('@');
                } else {
                    // atSign must be in auth portion.
                    // http://a@b/c@d => host:b auth:a path:/c@d
                    atSign = rest.lastIndexOf('@', hostEnd);
                }

                // Now we have a portion which is definitely the auth.
                // Pull that off.
                if (atSign !== -1) {
                    auth = rest.slice(0, atSign);
                    rest = rest.slice(atSign + 1);
                    this.auth = decodeURIComponent(auth);
                }

                // the host is the remaining to the left of the first non-host char
                hostEnd = -1;
                for (var i = 0; i < nonHostChars.length; i++) {
                    var hec = rest.indexOf(nonHostChars[i]);
                    if (hec !== -1 && (hostEnd === -1 || hec < hostEnd))
                        hostEnd = hec;
                }
                // if we still have not hit it, then the entire thing is a host.
                if (hostEnd === -1)
                    hostEnd = rest.length;

                this.host = rest.slice(0, hostEnd);
                rest = rest.slice(hostEnd);

                // pull out port.
                this.parseHost();

                // we've indicated that there is a hostname,
                // so even if it's empty, it has to be present.
                this.hostname = this.hostname || '';

                // if hostname begins with [ and ends with ]
                // assume that it's an IPv6 address.
                var ipv6Hostname = this.hostname[0] === '[' &&
                    this.hostname[this.hostname.length - 1] === ']';

                // validate a little.
                if (!ipv6Hostname) {
                    var hostparts = this.hostname.split(/\./);
                    for (var i = 0, l = hostparts.length; i < l; i++) {
                        var part = hostparts[i];
                        if (!part) continue;
                        if (!part.match(hostnamePartPattern)) {
                            var newpart = '';
                            for (var j = 0, k = part.length; j < k; j++) {
                                if (part.charCodeAt(j) > 127) {
                                    // we replace non-ASCII char with a temporary placeholder
                                    // we need this to make sure size of hostname is not
                                    // broken by replacing non-ASCII by nothing
                                    newpart += 'x';
                                } else {
                                    newpart += part[j];
                                }
                            }
                            // we test again with ASCII char only
                            if (!newpart.match(hostnamePartPattern)) {
                                var validParts = hostparts.slice(0, i);
                                var notHost = hostparts.slice(i + 1);
                                var bit = part.match(hostnamePartStart);
                                if (bit) {
                                    validParts.push(bit[1]);
                                    notHost.unshift(bit[2]);
                                }
                                if (notHost.length) {
                                    rest = '/' + notHost.join('.') + rest;
                                }
                                this.hostname = validParts.join('.');
                                break;
                            }
                        }
                    }
                }

                if (this.hostname.length > hostnameMaxLen) {
                    this.hostname = '';
                } else {
                    // hostnames are always lower case.
                    this.hostname = this.hostname.toLowerCase();
                }

                if (!ipv6Hostname) {
                    // IDNA Support: Returns a punycoded representation of "domain".
                    // It only converts parts of the domain name that
                    // have non-ASCII characters, i.e. it doesn't matter if
                    // you call it with a domain that already is ASCII-only.
                    this.hostname = punycode.toASCII(this.hostname);
                }

                var p = this.port ? ':' + this.port : '';
                var h = this.hostname || '';
                this.host = h + p;
                this.href += this.host;

                // strip [ and ] from the hostname
                // the host field still retains them, though
                if (ipv6Hostname) {
                    this.hostname = this.hostname.substr(1, this.hostname.length - 2);
                    if (rest[0] !== '/') {
                        rest = '/' + rest;
                    }
                }
            }

            // now rest is set to the post-host stuff.
            // chop off any delim chars.
            if (!unsafeProtocol[lowerProto]) {

                // First, make 100% sure that any "autoEscape" chars get
                // escaped, even if encodeURIComponent doesn't think they
                // need to be.
                for (var i = 0, l = autoEscape.length; i < l; i++) {
                    var ae = autoEscape[i];
                    if (rest.indexOf(ae) === -1)
                        continue;
                    var esc = encodeURIComponent(ae);
                    if (esc === ae) {
                        esc = escape(ae);
                    }
                    rest = rest.split(ae).join(esc);
                }
            }


            // chop off from the tail first.
            var hash = rest.indexOf('#');
            if (hash !== -1) {
                // got a fragment string.
                this.hash = rest.substr(hash);
                rest = rest.slice(0, hash);
            }
            var qm = rest.indexOf('?');
            if (qm !== -1) {
                this.search = rest.substr(qm);
                this.query = rest.substr(qm + 1);
                if (parseQueryString) {
                    this.query = querystring.parse(this.query);
                }
                rest = rest.slice(0, qm);
            } else if (parseQueryString) {
                // no query string, but parseQueryString still requested
                this.search = '';
                this.query = {};
            }
            if (rest) this.pathname = rest;
            if (slashedProtocol[lowerProto] &&
                this.hostname && !this.pathname) {
                this.pathname = '/';
            }

            //to support http.request
            if (this.pathname || this.search) {
                var p = this.pathname || '';
                var s = this.search || '';
                this.path = p + s;
            }

            // finally, reconstruct the href based on what has been validated.
            this.href = this.format();
            return this;
        };

        // format a parsed object into a url string
        function urlFormat(obj) {
            // ensure it's an object, and not a string url.
            // If it's an obj, this is a no-op.
            // this way, you can call url_format() on strings
            // to clean up potentially wonky urls.
            if (util.isString(obj)) obj = urlParse(obj);
            if (!(obj instanceof Url)) return Url.prototype.format.call(obj);
            return obj.format();
        }

        Url.prototype.format = function () {
            var auth = this.auth || '';
            if (auth) {
                auth = encodeURIComponent(auth);
                auth = auth.replace(/%3A/i, ':');
                auth += '@';
            }

            var protocol = this.protocol || '',
                pathname = this.pathname || '',
                hash = this.hash || '',
                host = false,
                query = '';

            if (this.host) {
                host = auth + this.host;
            } else if (this.hostname) {
                host = auth + (this.hostname.indexOf(':') === -1 ?
                               this.hostname :
                               '[' + this.hostname + ']');
                if (this.port) {
                    host += ':' + this.port;
                }
            }

            if (this.query &&
                util.isObject(this.query) &&
                Object.keys(this.query).length) {
                query = querystring.stringify(this.query);
            }

            var search = this.search || (query && ('?' + query)) || '';

            if (protocol && protocol.substr(-1) !== ':') protocol += ':';

            // only the slashedProtocols get the //.  Not mailto:, xmpp:, etc.
            // unless they had them to begin with.
            if (this.slashes ||
                (!protocol || slashedProtocol[protocol]) && host !== false) {
                host = '//' + (host || '');
                if (pathname && pathname.charAt(0) !== '/') pathname = '/' + pathname;
            } else if (!host) {
                host = '';
            }

            if (hash && hash.charAt(0) !== '#') hash = '#' + hash;
            if (search && search.charAt(0) !== '?') search = '?' + search;

            pathname = pathname.replace(/[?#]/g, function (match) {
                return encodeURIComponent(match);
            });
            search = search.replace('#', '%23');

            return protocol + host + pathname + search + hash;
        };

        function urlResolve(source, relative) {
            return urlParse(source, false, true).resolve(relative);
        }

        Url.prototype.resolve = function (relative) {
            return this.resolveObject(urlParse(relative, false, true)).format();
        };

        function urlResolveObject(source, relative) {
            if (!source) return relative;
            return urlParse(source, false, true).resolveObject(relative);
        }

        Url.prototype.resolveObject = function (relative) {
            if (util.isString(relative)) {
                var rel = new Url();
                rel.parse(relative, false, true);
                relative = rel;
            }

            var result = new Url();
            var tkeys = Object.keys(this);
            for (var tk = 0; tk < tkeys.length; tk++) {
                var tkey = tkeys[tk];
                result[tkey] = this[tkey];
            }

            // hash is always overridden, no matter what.
            // even href="" will remove it.
            result.hash = relative.hash;

            // if the relative url is empty, then there's nothing left to do here.
            if (relative.href === '') {
                result.href = result.format();
                return result;
            }

            // hrefs like //foo/bar always cut to the protocol.
            if (relative.slashes && !relative.protocol) {
                // take everything except the protocol from relative
                var rkeys = Object.keys(relative);
                for (var rk = 0; rk < rkeys.length; rk++) {
                    var rkey = rkeys[rk];
                    if (rkey !== 'protocol')
                        result[rkey] = relative[rkey];
                }

                //urlParse appends trailing / to urls like http://www.example.com
                if (slashedProtocol[result.protocol] &&
                    result.hostname && !result.pathname) {
                    result.path = result.pathname = '/';
                }

                result.href = result.format();
                return result;
            }

            if (relative.protocol && relative.protocol !== result.protocol) {
                // if it's a known url protocol, then changing
                // the protocol does weird things
                // first, if it's not file:, then we MUST have a host,
                // and if there was a path
                // to begin with, then we MUST have a path.
                // if it is file:, then the host is dropped,
                // because that's known to be hostless.
                // anything else is assumed to be absolute.
                if (!slashedProtocol[relative.protocol]) {
                    var keys = Object.keys(relative);
                    for (var v = 0; v < keys.length; v++) {
                        var k = keys[v];
                        result[k] = relative[k];
                    }
                    result.href = result.format();
                    return result;
                }

                result.protocol = relative.protocol;
                if (!relative.host && !hostlessProtocol[relative.protocol]) {
                    var relPath = (relative.pathname || '').split('/');
                    while (relPath.length && !(relative.host = relPath.shift()));
                    if (!relative.host) relative.host = '';
                    if (!relative.hostname) relative.hostname = '';
                    if (relPath[0] !== '') relPath.unshift('');
                    if (relPath.length < 2) relPath.unshift('');
                    result.pathname = relPath.join('/');
                } else {
                    result.pathname = relative.pathname;
                }
                result.search = relative.search;
                result.query = relative.query;
                result.host = relative.host || '';
                result.auth = relative.auth;
                result.hostname = relative.hostname || relative.host;
                result.port = relative.port;
                // to support http.request
                if (result.pathname || result.search) {
                    var p = result.pathname || '';
                    var s = result.search || '';
                    result.path = p + s;
                }
                result.slashes = result.slashes || relative.slashes;
                result.href = result.format();
                return result;
            }

            var isSourceAbs = (result.pathname && result.pathname.charAt(0) === '/'),
                isRelAbs = (
                    relative.host ||
                    relative.pathname && relative.pathname.charAt(0) === '/'
                ),
                mustEndAbs = (isRelAbs || isSourceAbs ||
                              (result.host && relative.pathname)),
                removeAllDots = mustEndAbs,
                srcPath = result.pathname && result.pathname.split('/') || [],
                relPath = relative.pathname && relative.pathname.split('/') || [],
                psychotic = result.protocol && !slashedProtocol[result.protocol];

            // if the url is a non-slashed url, then relative
            // links like ../.. should be able
            // to crawl up to the hostname, as well.  This is strange.
            // result.protocol has already been set by now.
            // Later on, put the first path part into the host field.
            if (psychotic) {
                result.hostname = '';
                result.port = null;
                if (result.host) {
                    if (srcPath[0] === '') srcPath[0] = result.host;
                    else srcPath.unshift(result.host);
                }
                result.host = '';
                if (relative.protocol) {
                    relative.hostname = null;
                    relative.port = null;
                    if (relative.host) {
                        if (relPath[0] === '') relPath[0] = relative.host;
                        else relPath.unshift(relative.host);
                    }
                    relative.host = null;
                }
                mustEndAbs = mustEndAbs && (relPath[0] === '' || srcPath[0] === '');
            }

            if (isRelAbs) {
                // it's absolute.
                result.host = (relative.host || relative.host === '') ?
                    relative.host : result.host;
                result.hostname = (relative.hostname || relative.hostname === '') ?
                    relative.hostname : result.hostname;
                result.search = relative.search;
                result.query = relative.query;
                srcPath = relPath;
                // fall through to the dot-handling below.
            } else if (relPath.length) {
                // it's relative
                // throw away the existing file, and take the new path instead.
                if (!srcPath) srcPath = [];
                srcPath.pop();
                srcPath = srcPath.concat(relPath);
                result.search = relative.search;
                result.query = relative.query;
            } else if (!util.isNullOrUndefined(relative.search)) {
                // just pull out the search.
                // like href='?foo'.
                // Put this after the other two cases because it simplifies the booleans
                if (psychotic) {
                    result.hostname = result.host = srcPath.shift();
                    //occationaly the auth can get stuck only in host
                    //this especially happens in cases like
                    //url.resolveObject('mailto:local1@domain1', 'local2@domain2')
                    var authInHost = result.host && result.host.indexOf('@') > 0 ?
                        result.host.split('@') : false;
                    if (authInHost) {
                        result.auth = authInHost.shift();
                        result.host = result.hostname = authInHost.shift();
                    }
                }
                result.search = relative.search;
                result.query = relative.query;
                //to support http.request
                if (!util.isNull(result.pathname) || !util.isNull(result.search)) {
                    result.path = (result.pathname ? result.pathname : '') +
                        (result.search ? result.search : '');
                }
                result.href = result.format();
                return result;
            }

            if (!srcPath.length) {
                // no path at all.  easy.
                // we've already handled the other stuff above.
                result.pathname = null;
                //to support http.request
                if (result.search) {
                    result.path = '/' + result.search;
                } else {
                    result.path = null;
                }
                result.href = result.format();
                return result;
            }

            // if a url ENDs in . or .., then it must get a trailing slash.
            // however, if it ends in anything else non-slashy,
            // then it must NOT get a trailing slash.
            var last = srcPath.slice(-1)[0];
            var hasTrailingSlash = (
                (result.host || relative.host || srcPath.length > 1) &&
                (last === '.' || last === '..') || last === '');

            // strip single dots, resolve double dots to parent dir
            // if the path tries to go above the root, `up` ends up > 0
            var up = 0;
            for (var i = srcPath.length; i >= 0; i--) {
                last = srcPath[i];
                if (last === '.') {
                    srcPath.splice(i, 1);
                } else if (last === '..') {
                    srcPath.splice(i, 1);
                    up++;
                } else if (up) {
                    srcPath.splice(i, 1);
                    up--;
                }
            }

            // if the path is allowed to go above the root, restore leading ..s
            if (!mustEndAbs && !removeAllDots) {
                for (; up--; up) {
                    srcPath.unshift('..');
                }
            }

            if (mustEndAbs && srcPath[0] !== '' &&
                (!srcPath[0] || srcPath[0].charAt(0) !== '/')) {
                srcPath.unshift('');
            }

            if (hasTrailingSlash && (srcPath.join('/').substr(-1) !== '/')) {
                srcPath.push('');
            }

            var isAbsolute = srcPath[0] === '' ||
                (srcPath[0] && srcPath[0].charAt(0) === '/');

            // put the host back
            if (psychotic) {
                result.hostname = result.host = isAbsolute ? '' :
                srcPath.length ? srcPath.shift() : '';
                //occationaly the auth can get stuck only in host
                //this especially happens in cases like
                //url.resolveObject('mailto:local1@domain1', 'local2@domain2')
                var authInHost = result.host && result.host.indexOf('@') > 0 ?
                    result.host.split('@') : false;
                if (authInHost) {
                    result.auth = authInHost.shift();
                    result.host = result.hostname = authInHost.shift();
                }
            }

            mustEndAbs = mustEndAbs || (result.host && srcPath.length);

            if (mustEndAbs && !isAbsolute) {
                srcPath.unshift('');
            }

            if (!srcPath.length) {
                result.pathname = null;
                result.path = null;
            } else {
                result.pathname = srcPath.join('/');
            }

            //to support request.http
            if (!util.isNull(result.pathname) || !util.isNull(result.search)) {
                result.path = (result.pathname ? result.pathname : '') +
                    (result.search ? result.search : '');
            }
            result.auth = relative.auth || result.auth;
            result.slashes = result.slashes || relative.slashes;
            result.href = result.format();
            return result;
        };

        Url.prototype.parseHost = function () {
            var host = this.host;
            var port = portPattern.exec(host);
            if (port) {
                port = port[0];
                if (port !== ':') {
                    this.port = port.substr(1);
                }
                host = host.substr(0, host.length - port.length);
            }
            if (host) this.hostname = host;
        };


        /***/
    }),

    /***/ "./node_modules/url/util.js":
    /*!**********************************!*\
  !*** ./node_modules/url/util.js ***!
  \**********************************/
    /*! no static exports found */
    /***/ (function (module, exports, __webpack_require__) {

        "use strict";


        module.exports = {
            isString: function (arg) {
                return typeof (arg) === 'string';
            },
            isObject: function (arg) {
                return typeof (arg) === 'object' && arg !== null;
            },
            isNull: function (arg) {
                return arg === null;
            },
            isNullOrUndefined: function (arg) {
                return arg == null;
            }
        };


        /***/
    }),

    /***/ "./node_modules/webpack/buildin/global.js":
    /*!***********************************!*\
  !*** (webpack)/buildin/global.js ***!
  \***********************************/
    /*! no static exports found */
    /***/ (function (module, exports) {

        var g;

        // This works in non-strict mode
        g = (function () {
            return this;
        })();

        try {
            // This works if eval is allowed (see CSP)
            g = g || new Function("return this")();
        } catch (e) {
            // This works if the window reference is available
            if (typeof window === "object") g = window;
        }

        // g can still be undefined, but nothing to do about it...
        // We return undefined, instead of nothing here, so it's
        // easier to handle this case. if(!global) { ...}

        module.exports = g;


        /***/
    }),

    /***/ "./node_modules/webpack/buildin/module.js":
    /*!***********************************!*\
  !*** (webpack)/buildin/module.js ***!
  \***********************************/
    /*! no static exports found */
    /***/ (function (module, exports) {

        module.exports = function (module) {
            if (!module.webpackPolyfill) {
                module.deprecate = function () { };
                module.paths = [];
                // module.parent = undefined by default
                if (!module.children) module.children = [];
                Object.defineProperty(module, "loaded", {
                    enumerable: true,
                    get: function () {
                        return module.l;
                    }
                });
                Object.defineProperty(module, "A", {
                    enumerable: true,
                    get: function () {
                        return module.i;
                    }
                });
                module.webpackPolyfill = 1;
            }
            return module;
        };


        /***/
    }),

    /***/ "./src/js/app.js":
    /*!***********************!*\
  !*** ./src/js/app.js ***!
  \***********************/
    /*! no static exports found */
    /***/ (function (module, exports, __webpack_require__) {

        "use strict";


        window.loadedScript = true;

        // ENV:
        var isProd = location.hostname !== "127.0.0.1" && !location.hostname.startsWith("192.168.");

        // IMPORTS:
        __webpack_require__(/*! ./libs/modernizr.js */ "./src/js/libs/modernizr.js");
        var io = __webpack_require__(/*! ./libs/io-client.js */ "./src/js/libs/io-client.js");
        window._gameIO = io; // expose io for bot diagnostics
        var UTILS = __webpack_require__(/*! ./libs/utils.js */ "./src/js/libs/utils.js");
        var animText = __webpack_require__(/*! ./libs/animText.js */ "./src/js/libs/animText.js");
        var config = __webpack_require__(/*! ./config.js */ "./src/js/config.js");
        var GameObject = __webpack_require__(/*! ./data/gameObject.js */ "./src/js/data/gameObject.js");
        var items = __webpack_require__(/*! ./data/items.js */ "./src/js/data/items.js");
        window._itemsList = items.list; window._itemsWeapons = items.weapons;
        var MapManager = __webpack_require__(/*! ./data/mapManager.js */ "./src/js/data/mapManager.js");
        var ObjectManager = __webpack_require__(/*! ./data/objectManager.js */ "./src/js/data/objectManager.js");
        var Player = __webpack_require__(/*! ./data/player.js */ "./src/js/data/player.js");
        var store = __webpack_require__(/*! ./data/store.js */ "./src/js/data/store.js");
        var Projectile = __webpack_require__(/*! ./data/projectile.js */ "./src/js/data/projectile.js");
        var ProjectileManager = __webpack_require__(/*! ./data/projectileManager.js */ "./src/js/data/projectileManager.js");
        var SoundManager = __webpack_require__(/*! ./libs/soundManager.js */ "./src/js/libs/soundManager.js").obj;
        var textManager = new animText.TextManager();

        // URL PARAMS:
        function getParameterByName(name, url) {
            if (!url) {
                url = window.location.href;
            }
            name = name.replace(/[\[\]]/g, "\\$&");
            var regex = new RegExp("[?&]" + name + "(=([^&#]*)|&|#|$)"),
                results = regex.exec(url);
            if (!results) return null;
            if (!results[2]) return '';
            return decodeURIComponent(results[2].replace(/\+/g, " "));
        }

        // SOCKET & CONNECTION:
        var connected = false;
        var startedConnecting = false;
        var capturedToken = "";

        window.connectSocket = connectSocket;

        // Intercept Turnstile token
        let originalTurnstile = window.onGotTurnstileToken;
        Object.defineProperty(window, 'onGotTurnstileToken', {
            set: function(fn) {
                originalTurnstile = fn;
            },
            get: function() {
                return function(token) {
                    capturedToken = token;
                    let enterBtn = document.getElementById("enterGame");
                    if (enterBtn) enterBtn.classList.remove("disabled");
                };
            },
            configurable: true
        });

        // Hijack the enter game button to prevent the original game from connecting
        let enterGameBtn = document.getElementById("enterGame");
        if (enterGameBtn) {
            let customOnClick = function(e) {
                if (enterGameBtn.classList.contains("disabled")) return;
                if (e && e.preventDefault) e.preventDefault();
                if (e && e.stopImmediatePropagation) e.stopImmediatePropagation();

                let tokenInput = document.querySelector('[name="cf-turnstile-response"]');
                let token = capturedToken || (tokenInput ? tokenInput.value : "");

                initMooMooConnection(token);
            };

            enterGameBtn.addEventListener("click", customOnClick, true);

            Object.defineProperty(enterGameBtn, 'onclick', {
                set: function(fn) { },
                get: function() { return customOnClick; },
                configurable: true
            });
        }

        async function initMooMooConnection(token) {
            if (startedConnecting) {
                if (connected) enterGame();
                return;
            }
            startedConnecting = true;

            showLoadingText("Connecting...");

            try {
                let isSandbox = window.location.hostname === "sandbox.moomoo.io";
                let apiHost = isSandbox ? "https://api-sandbox.moomoo.io" : "https://api.moomoo.io";
                let res = await fetch(apiHost + "/servers?v=1.27");
                let servers = await res.json();

                let targetServer = servers.find(s => s.playerCount < s.playerCapacity) || servers[0];
                let urlParams = new URLSearchParams(window.location.search);
                let serverParam = urlParams.get("server");
                if (serverParam) {
                    let [region, name] = serverParam.split(":");
                    let found = servers.find(s => s.region === region && s.name === name);
                    if (found) targetServer = found;
                }

                if (!targetServer) {
                    startedConnecting = false;
                    disconnect("No servers found");
                    return;
                }

                // The WebSocket domain is always moomoo.io, even for sandbox
                let wsUrl = "wss://" + targetServer.key + "." + targetServer.region + ".moomoo.io";
                if (targetServer.port && targetServer.port !== 443) {
                    wsUrl += ":" + targetServer.port;
                }
                if (token) {
                    wsUrl += "?token=" + encodeURIComponent("cf:" + token);
                }

                window._wsAddress = wsUrl; // expose on window for bots

                connectSocket(wsUrl);
            } catch (e) {
                console.error("Failed to fetch servers:", e);
                startedConnecting = false;
                disconnect("Connection Error");
            }
        }

        function connectSocket(wsAddress) {
            // CONNECT:
            io.connect(wsAddress, function (error) {
                pingSocket();
                setInterval(() => pingSocket(), 2500);

                if (error) {
                    startedConnecting = false;
                    disconnect(error);
                } else {
                    connected = true;
                    startGame();
                    enterGame();
                }
            }, {
                "A": setInitData,
                "B": disconnect,
                "C": setupGame,
                "D": addPlayer,
                "E": removePlayer,
                "a": updatePlayers,
                "G": updateLeaderboard,
                "H": loadGameObject,
                "I": loadAI,
                "J": animateAI,
                "K": gatherAnimation,
                "L": wiggleGameObject,
                "M": shootTurret,
                "N": updatePlayerValue,
                "O": updateHealth,
                "P": killPlayer,
                "Q": killObject,
                "R": killObjects,
                "S": updateItemCounts,
                "T": updateAge,
                "U": updateUpgrades,
                "V": updateItems,
                "X": addProjectile,
                "Y": remProjectile,
                "Z": serverShutdownNotice,
                "g": addAlliance,
                "1": deleteAlliance,
                "2": allianceNotification,
                "3": setPlayerTeam,
                "4": setAlliancePlayers,
                "5": updateStoreItems,
                "6": receiveChat,
                "7": updateMinimap,
                "8": showText,
                "9": pingMap,
                "0": pingSocketResponse
            });
        }
        function socketReady() {
            return (io.connected);
        }

        function joinParty() {
            var currentKey = serverBrowser.value;
            var key = prompt("party key", currentKey);
            if (key) {
                window.onbeforeunload = undefined; // Don't ask to leave
                window.location.href = "/?server=" + key;
            }
        } /**/

        // SOUND:
        var Sound = new SoundManager(config, UTILS);
        function toggleSound(active) {
            if (active == undefined)
                active = !Sound.active;
            Sound.active = active;
            //Sound.toggleMute("menu", !active);
            saveVal("moo_moosic", active ? 1 : 0);
        }

        // MATHS:
        var mathPI = Math.PI;
        var mathPI2 = mathPI * 2;
        var mathPI3 = mathPI * 3;
        Math.lerpAngle = function (value1, value2, amount) {
            var difference = Math.abs(value2 - value1);
            if (difference > mathPI) {
                if (value1 > value2) {
                    value2 += mathPI2;
                } else {
                    value1 += mathPI2;
                }
            }
            var value = (value2 + ((value1 - value2) * amount));
            if (value >= 0 && value <= mathPI2)
                return value;
            return (value % mathPI2);
        }

        // REOUNDED RECTANGLE:
        CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
            if (w < 2 * r) r = w / 2;
            if (h < 2 * r) r = h / 2;
            if (r < 0)
                r = 0;
            this.beginPath();
            this.moveTo(x + r, y);
            this.arcTo(x + w, y, x + w, y + h, r);
            this.arcTo(x + w, y + h, x, y + h, r);
            this.arcTo(x, y + h, x, y, r);
            this.arcTo(x, y, x + w, y, r);
            this.closePath();
            return this;
        }

        // STORAGE:
        var canStore;
        if (typeof (Storage) !== "undefined") {
            canStore = true;
        }
        function saveVal(name, val) {
            if (canStore)
                localStorage.setItem(name, val);
        }
        function deleteVal(name) {
            if (canStore)
                localStorage.removeItem(name);
        }
        function getSavedVal(name) {
            if (canStore)
                return localStorage.getItem(name);
            return null;
        }

        // TERMS:

        // GLOBAL VALUES:
        var moofoll = getSavedVal("moofoll");
        function follmoo() {
            if (!moofoll) {
                moofoll = true;
                saveVal("moofoll", 1);
            }
        }
        var useNativeResolution;
        var showPing;
        var playSound;
        var pixelDensity = 1;
        var delta, now, lastSent;
        var lastUpdate = Date.now();
        var keys, attackState;
        var ais = [];
        var players = [];
        // Keep window._players pointing to the live array
        Object.defineProperty(window, '_players', {
            get: function() { return players; },
            configurable: true
        });
        var alliances = [];
        Object.defineProperty(window, '_alliances', { get: function() { return alliances; }, configurable: true });
        var gameObjects = [];
        var projectiles = [];
        var projectileManager = new ProjectileManager(Projectile, projectiles, players, ais, objectManager, items, config, UTILS);
        var AiManager = __webpack_require__(/*! ./data/aiManager.js */ "./src/js/data/aiManager.js");
        var AI = __webpack_require__(/*! ./data/ai.js */ "./src/js/data/ai.js");
        var aiManager = new AiManager(ais, AI, players, items, null, config, UTILS);
        var myPlayer, myPlayerSID, tmpObj;
        var waterMult = 1;
        var waterPlus = 0;
        var mouseX = 0;
        var mouseY = 0;
        var controllingTouch = {
            id: -1,
            startX: 0,
            startY: 0,
            currentX: 0,
            currentY: 0
        };
        var attackingTouch = {
            id: -1,
            startX: 0,
            startY: 0,
            currentX: 0,
            currentY: 0
        };

        // LOAD SCREEN
        var camX, camY;
        var tmpDir;
        var skinColor = 0;
        var selectSkinIndex = 0;
        var maxScreenWidth = config.maxScreenWidth;
        var maxScreenHeight = config.maxScreenHeight;
        var screenWidth, screenHeight;
        var inGame = false;
        var adContainer = document.getElementById("ad-container");
        var mainMenu = document.getElementById("mainMenu");
        var enterGameButton = document.getElementById("enterGame");
        var promoImageButton = document.getElementById("promoImg");
        var promoImageHolder = document.getElementById("promoImgHolder");
        promoImageButton.remove();
        promoImageHolder.remove();
        var partyButton = document.getElementById("partyButton");
        var joinPartyButton = document.getElementById("joinPartyButton");

        partyButton.remove(); // REMOVE PARTY BUTTON
        joinPartyButton.remove(); // REMOVE JOIN PARTY BUTTON
        // Hide ALTCHA captcha
        var altchaWidget = document.getElementById("altcha");
        if (altchaWidget) {
            altchaWidget.style.display = 'none';
        }
        document.getElementById("altServer").remove(); // REMOVE THE link to sandbox / normal moo
        document.getElementById("linksContainer2").remove();
        // Remove just the "How To Play" description
        document.querySelector('#guideCard .menuText').remove();
        // Remove desktop instructions
        document.getElementById('desktopInstructions').remove();
        // Remove mobile instructions
        document.getElementById('mobileInstructions').remove();
        // Remove "How To Play" header and text
        document.querySelectorAll('#guideCard .menuHeader').forEach(header => {
            if (header.textContent.includes('How To Play') ||
                header.textContent.includes('Controls') ||
                header.textContent.includes('Settings')) {
                header.remove();
            }
        });
        // Remove settings checkboxes
        document.querySelectorAll('.settingRadio').forEach(el => el.remove());
        // Remove "Created by FRVR" text
        document.querySelectorAll('.menuText').forEach(el => el.remove());

        var settingsButton = document.getElementById("settingsButton");
        var settingsButtonTitle = settingsButton.getElementsByTagName("span")[0];
        var allianceButton = document.getElementById("allianceButton");
        var storeButton = document.getElementById("storeButton");
        var chatButton = document.getElementById("chatButton");
        var gameCanvas = document.getElementById("gameCanvas");
        var mainContext = gameCanvas.getContext("2d");
        var serverBrowser = document.getElementById("serverBrowser");
        var nativeResolutionCheckbox = document.getElementById("nativeResolution");
        var showPingCheckbox = document.getElementById("showPing");
        var playMusicCheckbox = document.getElementById("playMusic");
        var pingDisplay = document.getElementById("pingDisplay");
        var shutdownDisplay = document.getElementById("shutdownDisplay");
        var menuCardHolder = document.getElementById("menuCardHolder");
        var guideCard = document.getElementById("guideCard");
        var loadingText = document.getElementById("loadingText");
        var gameUI = document.getElementById("gameUI");
        var actionBar = document.getElementById("actionBar");
        var scoreDisplay = document.getElementById("scoreDisplay");
        var foodDisplay = document.getElementById("foodDisplay");
        var woodDisplay = document.getElementById("woodDisplay");
        var stoneDisplay = document.getElementById("stoneDisplay");
        var killCounter = document.getElementById("killCounter");
        var leaderboardData = document.getElementById("leaderboardData");
        var nameInput = document.getElementById("nameInput");
        var itemInfoHolder = document.getElementById("itemInfoHolder");
        var ageText = document.getElementById("ageText");
        var ageBarBody = document.getElementById("ageBarBody");
        var upgradeHolder = document.getElementById("upgradeHolder");
        var upgradeCounter = document.getElementById("upgradeCounter");
        var allianceMenu = document.getElementById("allianceMenu");
        var allianceHolder = document.getElementById("allianceHolder");
        var allianceManager = document.getElementById("allianceManager");
        var mapDisplay = document.getElementById("mapDisplay");
        var diedText = document.getElementById("diedText");
        var skinColorHolder = document.getElementById("skinColorHolder");
        var mapContext = mapDisplay.getContext("2d");
        mapDisplay.width = 300;
        mapDisplay.height = 300;
        var storeMenu = document.getElementById("storeMenu");
        var storeHolder = document.getElementById("storeHolder");
        var noticationDisplay = document.getElementById("noticationDisplay");
        var hats = store.hats;
        var accessories = store.accessories;
        var objectManager = new ObjectManager(GameObject, gameObjects, UTILS, config);
        var outlineColor = "#525252";
        var darkOutlineColor = "#3d3f42";
        var outlineWidth = 5.5;


        function clicktheverify() {
            if (whereverifybutton) {
                whereverifybutton.click()
            }
        }
        setInterval(clicktheverify, 1000);



        // SET INIT DATA:
        function setInitData(data) {
            alliances = data.teams;
        }

        // ON LOAD:
        var inWindow = true;
        var didLoad = false;
        var captchaReady = false;

        // START AUTOCAPTCHA
        let whereverifybutton = document.querySelector("#altcha_checkbox");

        function isAltchaLoading() {
            let altchaFrame = document.querySelector("#altcha_iframe");
            if (!altchaFrame) {
                return false;
            }
            return altchaFrame.classList.contains("loading") || altchaFrame.style.display === "none";
        }

        let altchaInterval = setInterval(() => {
            if (isAltchaLoading()) {
                if (menuCardHolder) {
                    menuCardHolder.style.display = "none";
                }
            } else {
                if (menuCardHolder) {
                    menuCardHolder.style.display = "";
                }
                if (whereverifybutton) {
                    whereverifybutton.click();
                }
                clearInterval(altchaInterval);
            }
        }, 1000);
        // END AUTOCAPTCHA

        window.onblur = function () {
            inWindow = false;
        };
        window.onfocus = function () {
            inWindow = true;
            if (myPlayer && myPlayer.alive) {
                resetMoveDir();
            }
        };
        window.onload = function () {
            didLoad = true;
        };
        window.captchaCallback = function () {
            captchaReady = true;
        };


        // ── Altcha solver — no Web Workers (CSP-safe, uses crypto.subtle) ─
        // SHA-256 from Glotus (js-sha256, proven working)
        !function(){"use strict";function t(t,i){i?(d[0]=d[16]=d[1]=d[2]=d[3]=d[4]=d[5]=d[6]=d[7]=d[8]=d[9]=d[10]=d[11]=d[12]=d[13]=d[14]=d[15]=0,this.blocks=d):this.blocks=[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],t?(this.h0=3238371032,this.h1=914150663,this.h2=812702999,this.h3=4144912697,this.h4=4290775857,this.h5=1750603025,this.h6=1694076839,this.h7=3204075428):(this.h0=1779033703,this.h1=3144134277,this.h2=1013904242,this.h3=2773480762,this.h4=1359893119,this.h5=2600822924,this.h6=528734635,this.h7=1541459225),this.block=this.start=this.bytes=this.hBytes=0,this.finalized=this.hashed=!1,this.first=!0,this.is224=t}function i(i,r,s){var e,n=typeof i;if("string"===n){var o,a=[],u=i.length,c=0;for(e=0;e<u;++e)(o=i.charCodeAt(e))<128?a[c++]=o:o<2048?(a[c++]=192|o>>6,a[c++]=128|63&o):o<55296||o>=57344?(a[c++]=224|o>>12,a[c++]=128|o>>6&63,a[c++]=128|63&o):(o=65536+((1023&o)<<10|1023&i.charCodeAt(++e)),a[c++]=240|o>>18,a[c++]=128|o>>12&63,a[c++]=128|o>>6&63,a[c++]=128|63&o);i=a}else{if("object"!==n)throw new Error(h);if(null===i)throw new Error(h);if(f&&i.constructor===ArrayBuffer)i=new Uint8Array(i);else if(!(Array.isArray(i)||f&&ArrayBuffer.isView(i)))throw new Error(h)}i.length>64&&(i=new t(r,!0).update(i).array());var y=[],p=[];for(e=0;e<64;++e){var l=i[e]||0;y[e]=92^l,p[e]=54^l}t.call(this,r,s),this.update(p),this.oKeyPad=y,this.inner=!0,this.sharedMemory=s}var h="input is invalid type",r="object"==typeof window,s=r?window:{};s.JS_SHA256_NO_WINDOW&&(r=!1);var e=!r&&"object"==typeof self,n=!s.JS_SHA256_NO_NODE_JS&&"object"==typeof process&&process.versions&&process.versions.node;n?s=global:e&&(s=self);var o=!s.JS_SHA256_NO_COMMON_JS&&"object"==typeof module&&module.exports,a="function"==typeof define&&define.amd,f=!s.JS_SHA256_NO_ARRAY_BUFFER&&"undefined"!=typeof ArrayBuffer,u="0123456789abcdef".split(""),c=[-2147483648,8388608,32768,128],y=[24,16,8,0],p=[1116352408,1899447441,3049323471,3921009573,961987163,1508970993,2453635748,2870763221,3624381080,310598401,607225278,1426881987,1925078388,2162078206,2614888103,3248222580,3835390401,4022224774,264347078,604807628,770255983,1249150122,1555081692,1996064986,2554220882,2821834349,2952996808,3210313671,3336571891,3584528711,113926993,338241895,666307205,773529912,1294757372,1396182291,1695183700,1986661051,2177026350,2456956037,2730485921,2820302411,3259730800,3345764771,3516065817,3600352804,4094571909,275423344,430227734,506948616,659060556,883997877,958139571,1322822218,1537002063,1747873779,1955562222,2024104815,2227730452,2361852424,2428436474,2756734187,3204031479,3329325298],l=["hex","array","digest","arrayBuffer"],d=[];!s.JS_SHA256_NO_NODE_JS&&Array.isArray||(Array.isArray=function(t){return"[object Array]"===Object.prototype.toString.call(t)}),!f||!s.JS_SHA256_NO_ARRAY_BUFFER_IS_VIEW&&ArrayBuffer.isView||(ArrayBuffer.isView=function(t){return"object"==typeof t&&t.buffer&&t.buffer.constructor===ArrayBuffer});var A=function(i,h){return function(r){return new t(h,!0).update(r)[i]()}},w=function(i){var h=A("hex",i);n&&(h=b(h,i)),h.create=function(){return new t(i)},h.update=function(t){return h.create().update(t)};for(var r=0;r<l.length;++r){var s=l[r];h[s]=A(s,i)}return h},b=function(t,i){var r=eval("require('crypto')"),s=eval("require('buffer').Buffer"),e=i?"sha224":"sha256",n=function(i){if("string"==typeof i)return r.createHash(e).update(i,"utf8").digest("hex");if(null===i||void 0===i)throw new Error(h);return i.constructor===ArrayBuffer&&(i=new Uint8Array(i)),Array.isArray(i)||ArrayBuffer.isView(i)||i.constructor===s?r.createHash(e).update(new s(i)).digest("hex"):t(i)};return n},v=function(t,h){return function(r,s){return new i(r,h,!0).update(s)[t]()}},_=function(t){var h=v("hex",t);h.create=function(h){return new i(h,t)},h.update=function(t,i){return h.create(t).update(i)};for(var r=0;r<l.length;++r){var s=l[r];h[s]=v(s,t)}return h};t.prototype.update=function(t){if(!this.finalized){var i,r=typeof t;if("string"!==r){if("object"!==r)throw new Error(h);if(null===t)throw new Error(h);if(f&&t.constructor===ArrayBuffer)t=new Uint8Array(t);else if(!(Array.isArray(t)||f&&ArrayBuffer.isView(t)))throw new Error(h);i=!0}for(var s,e,n=0,o=t.length,a=this.blocks;n<o;){if(this.hashed&&(this.hashed=!1,a[0]=this.block,a[16]=a[1]=a[2]=a[3]=a[4]=a[5]=a[6]=a[7]=a[8]=a[9]=a[10]=a[11]=a[12]=a[13]=a[14]=a[15]=0),i)for(e=this.start;n<o&&e<64;++n)a[e>>2]|=t[n]<<y[3&e++];else for(e=this.start;n<o&&e<64;++n)(s=t.charCodeAt(n))<128?a[e>>2]|=s<<y[3&e++]:s<2048?(a[e>>2]|=(192|s>>6)<<y[3&e++],a[e>>2]|=(128|63&s)<<y[3&e++]):s<55296||s>=57344?(a[e>>2]|=(224|s>>12)<<y[3&e++],a[e>>2]|=(128|s>>6&63)<<y[3&e++],a[e>>2]|=(128|63&s)<<y[3&e++]):(s=65536+((1023&s)<<10|1023&t.charCodeAt(++n)),a[e>>2]|=(240|s>>18)<<y[3&e++],a[e>>2]|=(128|s>>12&63)<<y[3&e++],a[e>>2]|=(128|s>>6&63)<<y[3&e++],a[e>>2]|=(128|63&s)<<y[3&e++]);this.lastByteIndex=e,this.bytes+=e-this.start,e>=64?(this.block=a[16],this.start=e-64,this.hash(),this.hashed=!0):this.start=e}return this.bytes>4294967295&&(this.hBytes+=this.bytes/4294967296<<0,this.bytes=this.bytes%4294967296),this}},t.prototype.finalize=function(){if(!this.finalized){this.finalized=!0;var t=this.blocks,i=this.lastByteIndex;t[16]=this.block,t[i>>2]|=c[3&i],this.block=t[16],i>=56&&(this.hashed||this.hash(),t[0]=this.block,t[16]=t[1]=t[2]=t[3]=t[4]=t[5]=t[6]=t[7]=t[8]=t[9]=t[10]=t[11]=t[12]=t[13]=t[14]=t[15]=0),t[14]=this.hBytes<<3|this.bytes>>>29,t[15]=this.bytes<<3,this.hash()}},t.prototype.hash=function(){var t,i,h,r,s,e,n,o,a,f=this.h0,u=this.h1,c=this.h2,y=this.h3,l=this.h4,d=this.h5,A=this.h6,w=this.h7,b=this.blocks;for(t=16;t<64;++t)i=((s=b[t-15])>>>7|s<<25)^(s>>>18|s<<14)^s>>>3,h=((s=b[t-2])>>>17|s<<15)^(s>>>19|s<<13)^s>>>10,b[t]=b[t-16]+i+b[t-7]+h<<0;for(a=u&c,t=0;t<64;t+=4)this.first?(this.is224?(e=300032,w=(s=b[0]-1413257819)-150054599<<0,y=s+24177077<<0):(e=704751109,w=(s=b[0]-210244248)-1521486534<<0,y=s+143694565<<0),this.first=!1):(i=(f>>>2|f<<30)^(f>>>13|f<<19)^(f>>>22|f<<10),r=(e=f&u)^f&c^a,w=y+(s=w+(h=(l>>>6|l<<26)^(l>>>11|l<<21)^(l>>>25|l<<7))+(l&d^~l&A)+p[t]+b[t])<<0,y=s+(i+r)<<0),i=(y>>>2|y<<30)^(y>>>13|y<<19)^(y>>>22|y<<10),r=(n=y&f)^y&u^e,A=c+(s=A+(h=(w>>>6|w<<26)^(w>>>11|w<<21)^(w>>>25|w<<7))+(w&l^~w&d)+p[t+1]+b[t+1])<<0,i=((c=s+(i+r)<<0)>>>2|c<<30)^(c>>>13|c<<19)^(c>>>22|c<<10),r=(o=c&y)^c&f^n,d=u+(s=d+(h=(A>>>6|A<<26)^(A>>>11|A<<21)^(A>>>25|A<<7))+(A&w^~A&l)+p[t+2]+b[t+2])<<0,i=((u=s+(i+r)<<0)>>>2|u<<30)^(u>>>13|u<<19)^(u>>>22|u<<10),r=(a=u&c)^u&y^o,l=f+(s=l+(h=(d>>>6|d<<26)^(d>>>11|d<<21)^(d>>>25|d<<7))+(d&A^~d&w)+p[t+3]+b[t+3])<<0,f=s+(i+r)<<0;this.h0=this.h0+f<<0,this.h1=this.h1+u<<0,this.h2=this.h2+c<<0,this.h3=this.h3+y<<0,this.h4=this.h4+l<<0,this.h5=this.h5+d<<0,this.h6=this.h6+A<<0,this.h7=this.h7+w<<0},t.prototype.hex=function(){this.finalize();var t=this.h0,i=this.h1,h=this.h2,r=this.h3,s=this.h4,e=this.h5,n=this.h6,o=this.h7,a=u[t>>28&15]+u[t>>24&15]+u[t>>20&15]+u[t>>16&15]+u[t>>12&15]+u[t>>8&15]+u[t>>4&15]+u[15&t]+u[i>>28&15]+u[i>>24&15]+u[i>>20&15]+u[i>>16&15]+u[i>>12&15]+u[i>>8&15]+u[i>>4&15]+u[15&i]+u[h>>28&15]+u[h>>24&15]+u[h>>20&15]+u[h>>16&15]+u[h>>12&15]+u[h>>8&15]+u[h>>4&15]+u[15&h]+u[r>>28&15]+u[r>>24&15]+u[r>>20&15]+u[r>>16&15]+u[r>>12&15]+u[r>>8&15]+u[r>>4&15]+u[15&r]+u[s>>28&15]+u[s>>24&15]+u[s>>20&15]+u[s>>16&15]+u[s>>12&15]+u[s>>8&15]+u[s>>4&15]+u[15&s]+u[e>>28&15]+u[e>>24&15]+u[e>>20&15]+u[e>>16&15]+u[e>>12&15]+u[e>>8&15]+u[e>>4&15]+u[15&e]+u[n>>28&15]+u[n>>24&15]+u[n>>20&15]+u[n>>16&15]+u[n>>12&15]+u[n>>8&15]+u[n>>4&15]+u[15&n];return this.is224||(a+=u[o>>28&15]+u[o>>24&15]+u[o>>20&15]+u[o>>16&15]+u[o>>12&15]+u[o>>8&15]+u[o>>4&15]+u[15&o]),a},t.prototype.toString=t.prototype.hex,t.prototype.digest=function(){this.finalize();var t=this.h0,i=this.h1,h=this.h2,r=this.h3,s=this.h4,e=this.h5,n=this.h6,o=this.h7,a=[t>>24&255,t>>16&255,t>>8&255,255&t,i>>24&255,i>>16&255,i>>8&255,255&i,h>>24&255,h>>16&255,h>>8&255,255&h,r>>24&255,r>>16&255,r>>8&255,255&r,s>>24&255,s>>16&255,s>>8&255,255&s,e>>24&255,e>>16&255,e>>8&255,255&e,n>>24&255,n>>16&255,n>>8&255,255&n];return this.is224||a.push(o>>24&255,o>>16&255,o>>8&255,255&o),a},t.prototype.array=t.prototype.digest,t.prototype.arrayBuffer=function(){this.finalize();var t=new ArrayBuffer(this.is224?28:32),i=new DataView(t);return i.setUint32(0,this.h0),i.setUint32(4,this.h1),i.setUint32(8,this.h2),i.setUint32(12,this.h3),i.setUint32(16,this.h4),i.setUint32(20,this.h5),i.setUint32(24,this.h6),this.is224||i.setUint32(28,this.h7),t},i.prototype=new t,i.prototype.finalize=function(){if(t.prototype.finalize.call(this),this.inner){this.inner=!1;var i=this.array();t.call(this,this.is224,this.sharedMemory),this.update(this.oKeyPad),this.update(i),t.prototype.finalize.call(this)}};var B=w();B.sha256=B,B.sha224=w(!0),B.sha256.hmac=_(),B.sha224.hmac=_(!0),window._botSha256=B.sha256}();
        // _botSha256 is now set on window

        window._createBotSocket = async function(href) {
            let url = href;
            if (/moomoo/.test(href)) {
                try {
                    const res = await fetch('https://api.moomoo.io/verify', { cache: 'no-store' });
                    const chal = await res.json();
                    const { algorithm = 'SHA-256', challenge, salt, signature, maxnumber = 2500000 } = chal;
                    let solved = null;
                    // Glotus formula: sha256(salt + n) === challenge
                    // Solve in chunks to avoid freezing the browser
                    solved = await new Promise(resolve => {
                        let n = 0;
                        function chunk() {
                            const end = Math.min(n + 5000, maxnumber);
                            for (; n <= end; n++) {
                                if (window._botSha256(salt + '' + n) === challenge) {
                                    resolve(n); return;
                                }
                            }
                            n = end + 1;
                            if (n > maxnumber) { resolve(null); return; }
                            setTimeout(chunk, 1);
                        }
                        chunk();
                    });
                    if (solved !== null) {
                        const payload = btoa(JSON.stringify({ algorithm, challenge, number: solved, salt, signature: signature || null, took: solved }));
                        const token = 'alt:' + payload;
                        const origin = new URL(href).origin;
                        url = origin + '/?token=' + token;
                    } else {
                        console.warn('[BOT] Could not solve challenge in', maxnumber, 'tries');
                    }
                } catch(e) {
                    console.warn('[BOT] Altcha error:', e.message);
                }
            }
            const WS = window.OriginalWebSocket || window.WebSocket;
            const ws = new WS(url);
            ws.binaryType = 'arraybuffer';
            return ws;
        };




        gameCanvas.oncontextmenu = function () {
            return false;
        };
        function disconnect(reason) {
            connected = false;
            io.close();
            showLoadingText(reason);
        }
        function showLoadingText(text) {
            mainMenu.style.display = "block";
            gameUI.style.display = "none";
            menuCardHolder.style.display = "none";
            diedText.style.display = "none";
            loadingText.style.display = "block";
            loadingText.innerHTML = text +
                "<a href='javascript:window.location.href=window.location.href' class='ytLink'>reload</a>";
        }

        // BUTTON EVENTS:
        function bindEvents() {
            enterGameButton.onclick = UTILS.checkTrusted(function () {
                // SHOW AD TO START GAME:
                // showPreAdIfReady();
            });
            UTILS.hookTouchEvents(enterGameButton);
            promoImageButton.onclick = UTILS.checkTrusted(function () {
                openLink('https://krunker.io/?play=SquidGame_KB');
            });
            UTILS.hookTouchEvents(promoImageButton);
            joinPartyButton.onclick = UTILS.checkTrusted(function () {
                setTimeout(function () { joinParty(); }, 10);
            });
            UTILS.hookTouchEvents(joinPartyButton);
            settingsButton.onclick = UTILS.checkTrusted(function () {
                toggleSettings();
            });
            UTILS.hookTouchEvents(settingsButton);
            allianceButton.onclick = UTILS.checkTrusted(function () {
                toggleAllianceMenu();
            });
            UTILS.hookTouchEvents(allianceButton);
            storeButton.onclick = UTILS.checkTrusted(function () {
                toggleStoreMenu();
            });
            UTILS.hookTouchEvents(storeButton);
            chatButton.onclick = UTILS.checkTrusted(function () {
                toggleChat();
            });
            UTILS.hookTouchEvents(chatButton);
            mapDisplay.onclick = UTILS.checkTrusted(function () {
                sendMapPing();
            });
            UTILS.hookTouchEvents(mapDisplay);
        }


        // ITEM COUNT DISPLAY:
        let isItemSetted = [];

        function updateItemCountDisplay(index = undefined) {
            for (let i = 3; i < items.list.length; ++i) {
                let id = items.list[i].group.id;
                let tmpI = items.weapons.length + i;
                if (!isItemSetted[tmpI]) {
                    isItemSetted[tmpI] = document.createElement("div");
                    isItemSetted[tmpI].id = "itemCount" + tmpI;
                    getEl("actionBarItem" + tmpI).appendChild(isItemSetted[tmpI]);
                    isItemSetted[tmpI].style = `
                            display: block;
                            position: absolute;
                            padding-left: 5px;
                            font-size: 2em;
                            color: #fff;
                            `;
                    isItemSetted[tmpI].innerHTML = myPlayer.itemCounts[id] || 0;
                } else {
                    if (index == id) isItemSetted[tmpI].innerHTML = myPlayer.itemCounts[index] || 0;
                }
            }
        }


        // SHOW ITEM INFO:
        function showItemInfo(item, isWeapon, isStoreItem) {
            if (myPlayer && item) {
                UTILS.removeAllChildren(itemInfoHolder);
                itemInfoHolder.classList.add("visible");
                // chatButton.classList.add("hide");
                UTILS.generateElement({
                    id: "itemInfoName",
                    text: UTILS.capitalizeFirst(item.name),
                    parent: itemInfoHolder
                });
                UTILS.generateElement({
                    id: "itemInfoDesc",
                    text: item.desc,
                    parent: itemInfoHolder
                });
                if (isStoreItem) {

                } else if (isWeapon) {
                    UTILS.generateElement({
                        class: "itemInfoReq",
                        text: !item.type ? "primary" : "secondary",
                        parent: itemInfoHolder
                    });
                } else {
                    for (var i = 0; i < item.req.length; i += 2) {
                        UTILS.generateElement({
                            class: "itemInfoReq",
                            html: item.req[i] + "<span class='itemInfoReqVal'> x" + item.req[i + 1] + "</span>",
                            parent: itemInfoHolder
                        });
                    }
                    if (item.group.limit) {
                        UTILS.generateElement({
                            class: "itemInfoLmt",
                            text: (myPlayer.itemCounts[item.group.id] || 0) + "/" + item.group.limit,
                            parent: itemInfoHolder
                        });
                    }
                }
            } else {
                itemInfoHolder.classList.remove("visible");
                // chatButton.classList.remove("hide");
            }
        }



        // SHOW ALLIANCE MENU:
        var allianceNotifications = [];
        var alliancePlayers = [];
        function allianceNotification(sid, name) {
            // Auto-accept if this is one of our bots
            const isBotRequest = window._bots && window._bots.some(function(b) {
                return b.alive && b.inGame && (
                    (b.name && name && name.startsWith(b.name.slice(0, 4))) ||
                    name === b.name
                );
            });
            if (isBotRequest) {
                // Auto-accept: send P + sid + 1
                io.send('P', sid, 1);
                return;
            }
            allianceNotifications.push({
                sid: sid,
                name: name
            });
            updateNotifications();
        }
        function updateNotifications() {
            if (allianceNotifications[0]) {
                var tmpN = allianceNotifications[0];
                UTILS.removeAllChildren(noticationDisplay);
                noticationDisplay.style.display = "block";
                UTILS.generateElement({
                    class: "notificationText",
                    text: tmpN.name,
                    parent: noticationDisplay
                });
                UTILS.generateElement({
                    class: "notifButton",
                    html: "<i class='material-icons' style='font-size:28px;color:#cc5151;'>&#xE14C;</i>",
                    parent: noticationDisplay,
                    onclick: function () { aJoinReq(0); },
                    hookTouch: true
                });
                UTILS.generateElement({
                    class: "notifButton",
                    html: "<i class='material-icons' style='font-size:28px;color:#8ecc51;'>&#xE876;</i>",
                    parent: noticationDisplay,
                    onclick: function () { aJoinReq(1); },
                    hookTouch: true
                });
            } else {
                noticationDisplay.style.display = "none";
            }
        }
        function addAlliance(data) {
            alliances.push(data);
            if (allianceMenu.style.display == "block")
                showAllianceMenu();
        }
        function setPlayerTeam(team, isOwner) {
            if (myPlayer) {
                myPlayer.team = team;
                myPlayer.isOwner = isOwner;
                window._ownerTeam = team; // expose for bots
                if (allianceMenu.style.display == "block")
                    showAllianceMenu();
            }
        }
        function setAlliancePlayers(data) {
            alliancePlayers = data;
            if (allianceMenu.style.display == "block")
                showAllianceMenu();
        }
        function deleteAlliance(sid) {
            for (var i = alliances.length - 1; i >= 0; i--) {
                if (alliances[i].sid == sid)
                    alliances.splice(i, 1);
            }
            if (allianceMenu.style.display == "block")
                showAllianceMenu();
        }
        function toggleAllianceMenu() {
            resetMoveDir();
            if (allianceMenu.style.display != "block") {
                showAllianceMenu();
            } else {
                allianceMenu.style.display = "none";
            }
        }
        function showAllianceMenu() {
            if (myPlayer && myPlayer.alive) {
                closeChat();
                storeMenu.style.display = "none";
                allianceMenu.style.display = "block";
                UTILS.removeAllChildren(allianceHolder);
                if (myPlayer.team) {
                    for (var i = 0; i < alliancePlayers.length; i += 2) {
                        (function (i) {
                            var tmp = UTILS.generateElement({
                                class: "allianceItem",
                                style: "color:" + (alliancePlayers[i] == myPlayer.sid ? "#fff" : "rgba(255,255,255,0.6)"),
                                text: alliancePlayers[i + 1],
                                parent: allianceHolder
                            });
                            if (myPlayer.isOwner && alliancePlayers[i] != myPlayer.sid) {
                                UTILS.generateElement({
                                    class: "joinAlBtn",
                                    text: "Kick",
                                    onclick: function () { kickFromClan(alliancePlayers[i]); },
                                    hookTouch: true,
                                    parent: tmp
                                });
                            }
                        })(i);
                    }
                } else {
                    if (alliances.length) {
                        for (var i = 0; i < alliances.length; ++i) {
                            (function (i) {
                                var tmp = UTILS.generateElement({
                                    class: "allianceItem",
                                    style: "color:" + (alliances[i].sid == myPlayer.team ? "#fff" : "rgba(255,255,255,0.6)"),
                                    text: alliances[i].sid,
                                    parent: allianceHolder
                                });
                                UTILS.generateElement({
                                    class: "joinAlBtn",
                                    text: "Join",
                                    onclick: function () { sendJoin(i); },
                                    hookTouch: true,
                                    parent: tmp
                                });
                            })(i);
                        }
                    } else {
                        UTILS.generateElement({
                            class: "allianceItem",
                            text: "No Tribes Yet",
                            parent: allianceHolder
                        });
                    }
                }
                UTILS.removeAllChildren(allianceManager);
                if (myPlayer.team) {
                    UTILS.generateElement({
                        class: "allianceButtonM",
                        style: "width: 360px",
                        text: myPlayer.isOwner ? "Delete Tribe" : "Leave Tribe",
                        onclick: function () { leaveAlliance() },
                        hookTouch: true,
                        parent: allianceManager
                    });
                } else {
                    UTILS.generateElement({
                        tag: "input",
                        type: "text",
                        id: "allianceInput",
                        maxLength: 7,
                        placeholder: "unique name",
                        ontouchstart: function (ev) {
                            ev.preventDefault();
                            var newValue = prompt("unique name", ev.currentTarget.value);
                            ev.currentTarget.value = newValue.slice(0, 7);
                        },
                        parent: allianceManager
                    });
                    UTILS.generateElement({
                        tag: "div",
                        class: "allianceButtonM",
                        style: "width: 140px;",
                        text: "Create",
                        onclick: function () { createAlliance(); },
                        hookTouch: true,
                        parent: allianceManager
                    });
                }
            }
        }
        function aJoinReq(join) {
            io.send("P", allianceNotifications[0].sid, join);
            allianceNotifications.splice(0, 1);
            updateNotifications();
        }
        function kickFromClan(sid) {
            io.send("Q", sid);
        }
        function sendJoin(index) {
            io.send("b", alliances[index].sid);
        }
        function createAlliance() {
            io.send("L", document.getElementById("allianceInput").value);
        }
        function leaveAlliance() {
            allianceNotifications = [];
            updateNotifications();
            io.send("N");
        }

        // MINIMAP:
        var lastDeath;
        var minimapData;
        var mapMarker;
        var mapPings = [];
        var tmpPing;
        function MapPing() {
            this.init = function (x, y) {
                this.scale = 0;
                this.x = x;
                this.y = y;
                this.active = true;
            };
            this.update = function (ctxt, delta) {
                if (this.active) {
                    this.scale += 0.05 * delta;
                    if (this.scale >= config.mapPingScale) {
                        this.active = false;
                    } else {
                        ctxt.globalAlpha = (1 - Math.max(0, this.scale / config.mapPingScale));
                        ctxt.beginPath();
                        ctxt.arc((this.x / config.mapScale) * mapDisplay.width, (this.y / config.mapScale)
                                 * mapDisplay.width, this.scale, 0, 2 * Math.PI);
                        ctxt.stroke();
                    }
                }
            };
        }
        function pingMap(x, y) {
            for (var i = 0; i < mapPings.length; ++i) {
                if (!mapPings[i].active) {
                    tmpPing = mapPings[i];
                    break;
                }
            }
            if (!tmpPing) {
                tmpPing = new MapPing();
                mapPings.push(tmpPing);
            }
            tmpPing.init(x, y);
        }
        function updateMapMarker() {
            if (!mapMarker)
                mapMarker = {};
            mapMarker.x = myPlayer.x;
            mapMarker.y = myPlayer.y;
        }
        function updateMinimap(data) {
            minimapData = data;
        }
        function renderMinimap(delta) {
            if (myPlayer && myPlayer.alive) {
                mapContext.clearRect(0, 0, mapDisplay.width, mapDisplay.height);

                // RENDER PINGS:
                mapContext.strokeStyle = "#fff";
                mapContext.lineWidth = 4;
                for (var i = 0; i < mapPings.length; ++i) {
                    tmpPing = mapPings[i];
                    tmpPing.update(mapContext, delta);
                }

                // RENDER PLAYERS:
                mapContext.globalAlpha = 1;
                mapContext.fillStyle = "#fff";
                renderCircle((myPlayer.x / config.mapScale) * mapDisplay.width,
                             (myPlayer.y / config.mapScale) * mapDisplay.height, 7, mapContext, true);
                mapContext.fillStyle = "rgba(255,255,255,0.35)";
                if (myPlayer.team && minimapData) {
                    for (var i = 0; i < minimapData.length;) {
                        renderCircle((minimapData[i] / config.mapScale) * mapDisplay.width,
                                     (minimapData[i + 1] / config.mapScale) * mapDisplay.height, 7, mapContext, true);
                        i += 2;
                    }
                }

                // DEATH LOCATION:
                if (lastDeath) {
                    mapContext.fillStyle = "#fc5553";
                    mapContext.font = "34px Hammersmith One";
                    mapContext.textBaseline = "middle";
                    mapContext.textAlign = "center";
                    mapContext.fillText("x", (lastDeath.x / config.mapScale) * mapDisplay.width,
                                        (lastDeath.y / config.mapScale) * mapDisplay.height);
                }

                // MAP MARKER:
                if (mapMarker) {
                    mapContext.fillStyle = "#fff";
                    mapContext.font = "34px Hammersmith One";
                    mapContext.textBaseline = "middle";
                    mapContext.textAlign = "center";
                    mapContext.fillText("x", (mapMarker.x / config.mapScale) * mapDisplay.width,
                                        (mapMarker.y / config.mapScale) * mapDisplay.height);
                }
            }
        }

        // STORE MENU:
        var currentStoreIndex = 0;
        var playerItems = {};
        function changeStoreIndex(index) {
            if (currentStoreIndex != index) {
                currentStoreIndex = index;
                generateStoreList();
            }
        }
        function toggleStoreMenu() {
            if (storeMenu.style.display != "block") {
                storeMenu.style.display = "block";
                allianceMenu.style.display = "none";
                closeChat();
                generateStoreList();
            } else {
                storeMenu.style.display = "none";
            }
        }
        function updateStoreItems(type, id, index) {
            if (index) {
                if (!type)
                    myPlayer.tails[id] = 1;
                else
                    myPlayer.tailIndex = id;
            } else {
                if (!type)
                    myPlayer.skins[id] = 1;
                else
                    myPlayer.skinIndex = id;
            }
            if (storeMenu.style.display == "block")
                generateStoreList();
        }
        function generateStoreList() {
            if (myPlayer) {
                UTILS.removeAllChildren(storeHolder);
                var index = currentStoreIndex;
                var tmpArray = index ? accessories : hats;
                for (var i = 0; i < tmpArray.length; ++i) {
                    if (!tmpArray[i].dontSell) {
                        (function (i) {
                            var tmp = UTILS.generateElement({
                                id: "storeDisplay" + i,
                                class: "storeItem",
                                onmouseout: function () { showItemInfo(); },
                                onmouseover: function () { showItemInfo(tmpArray[i], false, true); },
                                parent: storeHolder
                            });
                            UTILS.hookTouchEvents(tmp, true);
                            UTILS.generateElement({
                                tag: "img",
                                class: "hatPreview",
                                src: "../img/" + (index ? "accessories/access_" : "hats/hat_") + tmpArray[i].id + (tmpArray[i].topSprite ? "_p" : "") + ".png",
                                parent: tmp
                            });
                            UTILS.generateElement({
                                tag: "span",
                                text: tmpArray[i].name,
                                parent: tmp
                            });
                            if (index ? (!myPlayer.tails[tmpArray[i].id]) : (!myPlayer.skins[tmpArray[i].id])) {
                                UTILS.generateElement({
                                    class: "joinAlBtn",
                                    style: "margin-top: 5px",
                                    text: "Buy",
                                    onclick: function () { storeBuy(tmpArray[i].id, index); },
                                    hookTouch: true,
                                    parent: tmp
                                });
                                UTILS.generateElement({
                                    tag: "span",
                                    class: "itemPrice",
                                    text: tmpArray[i].price,
                                    parent: tmp
                                })
                            } else if ((index ? myPlayer.tailIndex : myPlayer.skinIndex) == tmpArray[i].id) {
                                UTILS.generateElement({
                                    class: "joinAlBtn",
                                    style: "margin-top: 5px",
                                    text: "Unequip",
                                    onclick: function () { storeEquip(0, index); },
                                    hookTouch: true,
                                    parent: tmp
                                });
                            } else {
                                UTILS.generateElement({
                                    class: "joinAlBtn",
                                    style: "margin-top: 5px",
                                    text: "Equip",
                                    onclick: function () { storeEquip(tmpArray[i].id, index); },
                                    hookTouch: true,
                                    parent: tmp
                                });
                            }
                        })(i);
                    }
                }
            }
        }
        function storeEquip(id, index) {
            io.send("c", 0, id, index);
        }
        function storeBuy(id, index) {
            io.send("c", 1, id, index);
        }

        // HIDE WINDOWS:
        function hideAllWindows() {
            storeMenu.style.display = "none";
            allianceMenu.style.display = "none";
            closeChat();
        }

        // PREPARE UI:
        function prepareUI() {

            // SHOW PING:
            showPing = getSavedVal("show_ping") == "true";
            pingDisplay.hidden = !showPing;

            // LOAD SOUND SETTING:
            playSound = getSavedVal("moo_moosic") || 0;

            // MOBILE DOWNLOADS:
            setInterval(function () {
                if (window.cordova) {
                    document.getElementById("downloadButtonContainer").classList.add("cordova");
                    document.getElementById("mobileDownloadButtonContainer").classList.add("cordova");
                }
            }, 1000);

            // SKIN COLOR PICKER:
            updateSkinColorPicker();

            // ACTION BAR:
            UTILS.removeAllChildren(actionBar);
            for (var i = 0; i < (items.weapons.length + items.list.length); ++i) {
                (function (i) {
                    UTILS.generateElement({
                        id: "actionBarItem" + i,
                        class: "actionBarItem",
                        style: "display:none",
                        onmouseout: function () {
                            showItemInfo();
                        },
                        parent: actionBar
                    });
                })(i);
            }
            for (var i = 0; i < (items.list.length + items.weapons.length); ++i) {
                (function (i) {
                    var tmpCanvas = document.createElement('canvas');
                    tmpCanvas.width = tmpCanvas.height = 66;
                    var tmpContext = tmpCanvas.getContext('2d');
                    tmpContext.translate((tmpCanvas.width / 2), (tmpCanvas.height / 2));
                    tmpContext.imageSmoothingEnabled = false;
                    tmpContext.webkitImageSmoothingEnabled = false;
                    tmpContext.mozImageSmoothingEnabled = false;
                    if (items.weapons[i]) {
                        tmpContext.rotate((Math.PI / 4) + Math.PI);
                        var tmpSprite = new Image();
                        toolSprites[items.weapons[i].src] = tmpSprite;
                        tmpSprite.onload = function () {
                            this.isLoaded = true;
                            var tmpPad = 1 / (this.height / this.width);
                            var tmpMlt = (items.weapons[i].iPad || 1);
                            tmpContext.drawImage(this, -(tmpCanvas.width * tmpMlt * config.iconPad * tmpPad) / 2, -(tmpCanvas.height * tmpMlt * config.iconPad) / 2,
                                                 tmpCanvas.width * tmpMlt * tmpPad * config.iconPad, tmpCanvas.height * tmpMlt * config.iconPad);
                            tmpContext.fillStyle = "rgba(0, 0, 70, 0.1)";
                            tmpContext.globalCompositeOperation = "source-atop";
                            tmpContext.fillRect(-tmpCanvas.width / 2, -tmpCanvas.height / 2, tmpCanvas.width, tmpCanvas.height);
                            document.getElementById('actionBarItem' + i).style.backgroundImage = "url(" + tmpCanvas.toDataURL() + ")";
                        };
                        tmpSprite.src = ".././img/weapons/" + items.weapons[i].src + ".png";
                        var tmpUnit = document.getElementById('actionBarItem' + i);
                        tmpUnit.onmouseover = UTILS.checkTrusted(function () {
                            showItemInfo(items.weapons[i], true);
                        });
                        tmpUnit.onclick = UTILS.checkTrusted(function () {
                            selectToBuild(i, true);
                        });
                        UTILS.hookTouchEvents(tmpUnit);
                    } else {
                        var tmpSprite = getItemSprite(items.list[i - items.weapons.length], true);
                        var tmpScale = Math.min(tmpCanvas.width - config.iconPadding, tmpSprite.width);
                        tmpContext.globalAlpha = 1;
                        tmpContext.drawImage(tmpSprite, -tmpScale / 2, -tmpScale / 2, tmpScale, tmpScale);
                        tmpContext.fillStyle = "rgba(0, 0, 70, 0.1)";
                        tmpContext.globalCompositeOperation = "source-atop";
                        tmpContext.fillRect(-tmpScale / 2, -tmpScale / 2, tmpScale, tmpScale);
                        document.getElementById('actionBarItem' + i).style.backgroundImage = "url(" + tmpCanvas.toDataURL() + ")";
                        var tmpUnit = document.getElementById('actionBarItem' + i);
                        tmpUnit.onmouseover = UTILS.checkTrusted(function () {
                            showItemInfo(items.list[i - items.weapons.length]);
                        });
                        tmpUnit.onclick = UTILS.checkTrusted(function () {
                            selectToBuild(i - items.weapons.length);
                        });
                        UTILS.hookTouchEvents(tmpUnit);
                    }
                })(i);
            }

            // MOBILE NAME INPUT:
            nameInput.ontouchstart = UTILS.checkTrusted(function (e) {
                e.preventDefault();
                var newValue = prompt("enter name", e.currentTarget.value);
                e.currentTarget.value = newValue.slice(0, 15);
            });


            // PLAY MENU SOUND:
            // Sound.play("menu", 1, true);
        }
        function updateItems(data, wpn) {
            if (data) {
                if (wpn) myPlayer.weapons = data;
                else myPlayer.items = data;
            }
            for (var i = 0; i < items.list.length; ++i) {
                var tmpI = (items.weapons.length + i);
                document.getElementById("actionBarItem" + tmpI).style.display = myPlayer.items.indexOf(items.list[i].id) >= 0 ? "inline-block" : "none";
            }
            for (var i = 0; i < items.weapons.length; ++i) {
                document.getElementById("actionBarItem" + i).style.display = (myPlayer.weapons[items.weapons[i].type] == items.weapons[i].id) ? "inline-block" : "none";
            }

            if (keyCodeWeapon < 9) {
                keyCodeWeapon = myPlayer.weapons[0];
            } else {
                keyCodeWeapon = myPlayer.weapons[1];
            }
        }

        function updateGuide() {
            if (usingTouch) {
                guideCard.classList.add("touch");
            } else {
                guideCard.classList.remove("touch");
            }
        }

        // SETTINGS STUFF:
        function toggleSettings() {
            if (guideCard.classList.contains("showing")) {
                guideCard.classList.remove("showing");
                settingsButtonTitle.innerText = "Settings";
            } else {
                guideCard.classList.add("showing");
                settingsButtonTitle.innerText = "Close";
            }
        }

        // SELECT SKIN COLOR:
        function updateSkinColorPicker() {
            var tmpHTML = "";
            for (var i = 0; i < config.skinColors.length; ++i) {
                if (i == selectSkinIndex) {
                    tmpHTML += ("<div class='skinColorItem activeSkin' style='background-color:" +
                                config.skinColors[i] + "' onclick='selectSkinColor(" + i + ")'></div>");
                } else {
                    tmpHTML += ("<div class='skinColorItem' style='background-color:" +
                                config.skinColors[i] + "' onclick='selectSkinColor(" + i + ")'></div>");
                }
            }
            skinColorHolder.innerHTML = tmpHTML;
        }
        function selectSkinColor(index) {
            selectSkinIndex = index;
            skinColor = index == 10 ? "__lookupGetter__" : index;
            updateSkinColorPicker();
        }

        // CHAT STUFF:
        var chatBox = document.getElementById("chatBox");
        var chatHolder = document.getElementById("chatHolder");
        function toggleChat() {
            if (!usingTouch) {
                if (chatHolder.style.display == "block") {
                    if (chatBox.value) {
                        sendChat(chatBox.value);
                    }
                    closeChat();
                } else {
                    storeMenu.style.display = "none";
                    allianceMenu.style.display = "none";
                    chatHolder.style.display = "block";
                    chatBox.focus();
                    resetMoveDir();
                }
            } else {
                setTimeout(function () { // Timeout lets the `hookTouchEvents` function exit
                    var chatMessage = prompt("chat message");
                    if (chatMessage) {
                        sendChat(chatMessage);
                    }
                }, 1);
            }
            chatBox.value = "";
        }
        function sendChat(message) {
            io.send("6", message.slice(0, 30));
        }
        function closeChat() {
            chatBox.value = "";
            chatHolder.style.display = "none";
        }

        // SEND MESSAGE:
        var profanityList = ["cunt", "whore", "fuck", "shit", "faggot", "nigger",
                             "nigga", "dick", "vagina", "minge", "cock", "rape", "cum", "sex",
                             "tits", "penis", "clit", "pussy", "meatcurtain", "jizz", "prune",
                             "douche", "wanker", "damn", "bitch", "dick", "fag", "bastard"];
        function checkProfanityString(text) {
            var tmpString;
            for (var i = 0; i < profanityList.length; ++i) {
                if (text.indexOf(profanityList[i]) > -1) {
                    tmpString = "";
                    for (var y = 0; y < profanityList[i].length; ++y) {
                        tmpString += tmpString.length ? "o" : "M";
                    }
                    var re = new RegExp(profanityList[i], 'g');
                    text = text.replace(re, tmpString);
                }
            }
            return text;
        }
        function receiveChat(sid, message) {
            var tmpPlayer = findPlayerBySID(sid);
            if (tmpPlayer) {
                tmpPlayer.chatMessage = checkProfanityString(message);
                tmpPlayer.chatCountdown = config.chatCountdown;
            }
        }

        let factor = 1.0; // Zoom factor
        function lerp(start, end, t) {
            return start + (end - start) * t;
        }

        function resetZoom() {
            var newW = config.maxScreenWidth * factor;
            var newH = config.maxScreenHeight * factor;

            if (maxScreenWidth != newW || maxScreenHeight != newH) {
                maxScreenWidth = newW;
                maxScreenHeight = newH;
                resize();
                if (myPlayer) {
                    let targetCamX = myPlayer.x + (maxScreenWidth / 2) / config.playerScale;
                    let targetCamY = myPlayer.y + (maxScreenHeight / 2) / config.playerScale;
                    camX = lerp(camX, targetCamX, 0.15);
                    camY = lerp(camY, targetCamY, 0.15);
                }
            }
        }

        // RESIZE (your existing function stays the same):
        window.addEventListener('resize', UTILS.checkTrusted(resize));
        function resize() {
            screenWidth = window.innerWidth;
            screenHeight = window.innerHeight;
            var scaleFillNative = Math.max(screenWidth / maxScreenWidth, screenHeight / maxScreenHeight) * pixelDensity;
            gameCanvas.width = screenWidth * pixelDensity;
            gameCanvas.height = screenHeight * pixelDensity;
            gameCanvas.style.width = screenWidth + "px";
            gameCanvas.style.height = screenHeight + "px";
            mainContext.setTransform(
                scaleFillNative, 0,
                0, scaleFillNative,
                (screenWidth * pixelDensity - (maxScreenWidth * scaleFillNative)) / 2,
                (screenHeight * pixelDensity - (maxScreenHeight * scaleFillNative)) / 2
            );
        }
        resize();

        // Scroll zoom — skip when rageok menu is open
        window.addEventListener('wheel', (e) => {
            // Don't zoom when the menu is open (prevents scroll-zoom on menu)
            if (document.querySelector('.rageok-root.active')) return;
            e.preventDefault();

            const zoomSpeed = 0.1;
            const minFactor = 0.5;  // More FOV
            const maxFactor = 8.0;  // Less FOV

            if (e.deltaY < 0) {
                // Scroll up - see more
                factor = Math.min(factor + zoomSpeed, maxFactor);
            } else {
                // Scroll down - see less
                factor = Math.max(factor - zoomSpeed, minFactor);
            }

            resetZoom();
        }, { passive: false });

        // TOUCH INPUT:
        var usingTouch;
        setUsingTouch(false);
        function setUsingTouch(using) {
            usingTouch = using;
            updateGuide();
        }
        window.setUsingTouch = setUsingTouch;

        gameCanvas.addEventListener('touchmove', UTILS.checkTrusted(touchMove), false);
        function touchMove(ev) {
            ev.preventDefault();
            ev.stopPropagation();
            setUsingTouch(true);
            for (var i = 0; i < ev.changedTouches.length; i++) {
                var t = ev.changedTouches[i];
                if (t.identifier == controllingTouch.id) {
                    controllingTouch.currentX = t.pageX;
                    controllingTouch.currentY = t.pageY;
                    sendMoveDir();
                } else if (t.identifier == attackingTouch.id) {
                    attackingTouch.currentX = t.pageX;
                    attackingTouch.currentY = t.pageY;
                    attackState = 1;
                }
            }
        }
        gameCanvas.addEventListener('touchstart', UTILS.checkTrusted(touchStart), false);
        function touchStart(ev) {
            ev.preventDefault();
            ev.stopPropagation();
            setUsingTouch(true);
            for (var i = 0; i < ev.changedTouches.length; i++) {
                var t = ev.changedTouches[i];
                if (t.pageX < document.body.scrollWidth / 2 && controllingTouch.id == -1) {
                    controllingTouch.id = t.identifier;
                    controllingTouch.startX = controllingTouch.currentX = t.pageX;
                    controllingTouch.startY = controllingTouch.currentY = t.pageY;
                    sendMoveDir();
                } else if (t.pageX > document.body.scrollWidth / 2 && attackingTouch.id == -1) {
                    attackingTouch.id = t.identifier;
                    attackingTouch.startX = attackingTouch.currentX = t.pageX;
                    attackingTouch.startY = attackingTouch.currentY = t.pageY;
                    if (myPlayer.buildIndex < 0) {
                        attackState = 1;
                        sendAtckState();
                    }
                }
            }
        }
        gameCanvas.addEventListener('touchend', UTILS.checkTrusted(touchEnd), false);
        gameCanvas.addEventListener('touchcancel', UTILS.checkTrusted(touchEnd), false);
        gameCanvas.addEventListener('touchleave', UTILS.checkTrusted(touchEnd), false);
        function touchEnd(ev) {
            ev.preventDefault();
            ev.stopPropagation();
            setUsingTouch(true);
            for (var i = 0; i < ev.changedTouches.length; i++) {
                var t = ev.changedTouches[i];
                if (t.identifier == controllingTouch.id) {
                    controllingTouch.id = -1;
                    sendMoveDir();
                } else if (t.identifier == attackingTouch.id) {
                    attackingTouch.id = -1;
                    if (myPlayer.buildIndex >= 0) {
                        attackState = 1;
                        sendAtckState();
                    }
                    attackState = 0;
                    sendAtckState();
                }
            }
        }


        // MOUSE INPUT:
        const mals = document.getElementById('touch-controls-fullscreen');
        mals.style.display = 'block';
        mals.addEventListener("mousemove", gameInput, false);
        function gameInput(e) {
            e.preventDefault();
            e.stopPropagation();
            setUsingTouch(false);
            mouseX = e.clientX;
            mouseY = e.clientY;
        }

        mals.addEventListener("mousedown", mouseDown, false);
        function mouseDown(e) {
            e.preventDefault();
            setUsingTouch(false);

            if (e.button === 0) { // Left click
                leftClick = true;
            } else if (e.button === 2) { // Right click
                rightClick = true;
            }
        }

        mals.addEventListener("mouseup", mouseUp, false);
        function mouseUp(e) {
            e.preventDefault();
            setUsingTouch(false);

            if (e.button === 0) { // Left click
                leftClick = false;
            } else if (e.button === 2) { // Right click
                rightClick = false;
            }
        }

        // Prevent context menu on right click
        mals.addEventListener("contextmenu", (e) => {
            e.preventDefault();
        }, false);

        // INPUT UTILS:
        function getMoveDir() {
            var dx = 0;
            var dy = 0;
            if (controllingTouch.id != -1) {
                dx += controllingTouch.currentX - controllingTouch.startX;
                dy += controllingTouch.currentY - controllingTouch.startY;
            } else {
                for (var key in moveKeys) {
                    var tmpDir = moveKeys[key];
                    dx += !!keys[key] * tmpDir[0];
                    dy += !!keys[key] * tmpDir[1];
                }
            }
            return (dx == 0 && dy == 0) ? undefined : UTILS.fixTo(Math.atan2(dy, dx), 2);
        }
        var lastDir;
        let lessDir = undefined;
        let tmpAttackDir = undefined;
        let plusDir = 0;
        function getAttackDir() {
            if (myPlayer) {
                if (autoaim && nearestEnemy) {
                    return autoaimAngle;
                }

                if (antiPush) {
                    return antiPushAngle;
                }

                if (autoBreak) {
                    return autoBreakAngle;
                }

                if (gatherGrind && grindAngle) {
                    return grindAngle;
                }


                if (!myPlayer.lockDir && !usingTouch) {
                    lastDir = Math.atan2(mouseY - (screenHeight / 2), mouseX - (screenWidth / 2));
                    return UTILS.fixTo(lastDir || 0, 2);
                }
            }

            return 0;
        }

        // KEYS:
        var keys = {};
        var moveKeys = {
            87: [0, -1],
            38: [0, -1],
            83: [0, 1],
            40: [0, 1],
            65: [-1, 0],
            37: [-1, 0],
            68: [1, 0],
            39: [1, 0]
        };
        function resetMoveDir() {
            keys = {};
            io.send("e");
        }
        function keysActive() {
            // Don't pass keypresses to game if typing in rageok menu inputs
            const focused = document.activeElement;
            if (focused && (focused.tagName === 'INPUT' || focused.tagName === 'TEXTAREA')) {
                const menuRoot = document.querySelector('.rageok-root');
                if (menuRoot && menuRoot.contains(focused)) return false;
            }
            return (allianceMenu.style.display != "block"
                    && chatHolder.style.display != "block");
        }
        let killCount = 0;
        let previousDeadPlayers = new Set();
        let lastDamageDealtTo = null; // Track who we damaged last

        function setLastDmg(playerSid) {
            lastDamageDealtTo = playerSid; // Store the player's SID who we damaged
        }

        function getLastDmg() {
            return lastDamageDealtTo;
        }

        function getKilledPlayer() {
            for (let i = 0; i < players.length; i++) {
                let p = players[i];
                if (p && p.sid !== myPlayer.sid && !isAlly(p.sid) && p.health <= 0) {
                    // Check if this is the player we last damaged
                    if (p.sid === lastDamageDealtTo && !previousDeadPlayers.has(p.sid)) {
                        previousDeadPlayers.add(p.sid);
                        return p.name;
                    }
                }
            }
            return null;
        }

        function showKillMessage(victimName) {
            killCount++;
            const messageDiv = document.createElement('div');
            messageDiv.textContent = `${near.name} has died.`;

            Object.assign(messageDiv.style, {
                position: "fixed",
                top: "1200px",
                left: "70%",
                transform: "translateX(-50%) translateY(-50px)",
                backgroundColor: "#1a1a1a",
                backgroundImage: "linear-gradient(to right, rgba(20, 20, 20, 0.95), rgba(40, 40, 40, 0.95))",
                color: "#ffffff",
                padding: "10px 25px",
                borderRadius: "15px",
                fontSize: "1.1rem",
                fontWeight: "bold",
                letterSpacing: "1px",
                textShadow: "0 0 5px rgba(255,255,255,0.7)",
                zIndex: "1000",
                boxShadow: "0 8px 20px rgba(0, 0, 0, 0.8), inset 0 0 10px rgba(0, 0, 0, 0.9), 0 0 15px rgba(50, 50, 50, 0.9)",
                border: "2px solid rgba(100, 100, 100, 0.5)",
                opacity: "0",
                transition: "opacity 0.6s ease-out, transform 0.6s ease-out",
                willChange: "opacity, transform"
            });
            document.body.appendChild(messageDiv);

            requestAnimationFrame(() => {
                messageDiv.style.opacity = "1";
                messageDiv.style.transform = "translateX(-50%) translateY(0)";
            });

            setTimeout(() => {
                messageDiv.style.opacity = "0";
                messageDiv.style.transform = "translateX(-50%) translateY(-50px)";
                messageDiv.addEventListener("transitionend", () => {
                    if (messageDiv.parentNode) {
                        messageDiv.parentNode.removeChild(messageDiv);
                    }
                }, { once: true });
            }, 2500);
        }

        function checkForKills() {
            let victimName = getKilledPlayer();
            if (victimName) {
                showKillMessage(victimName);
            }
        }

        // Usage:
        // When you deal damage to a player, call:
        // setLastDmg(targetPlayer.sid);
        // Then in your game loop call:
        // checkForKills();

        function keyDown(event) {
            // If user is typing in the rageok menu, don't let the game capture it
            const focused = document.activeElement;
            if (focused && (focused.tagName === 'INPUT' || focused.tagName === 'TEXTAREA')) {
                const menuRoot = document.querySelector('.rageok-root');
                if (menuRoot && menuRoot.contains(focused)) {
                    event.stopImmediatePropagation();
                    return;
                }
            }
            let keyStr = event.code ?? "";
            if (keyStr.startsWith("Key")) keyStr = keyStr.slice(3);
            if (keyStr.startsWith("Digit")) keyStr = keyStr.slice(5);
            keyStr = keyStr.toUpperCase();
            var keyNum = event.which || event.keyCode || 0;
            if (keyNum == 27) {
                if (!keys[keyNum]) {
                    keys[keyNum] = 1;
                    if (myPlayer && myPlayer.alive) {
                        hideAllWindows();
                        $("#modMenus").toggle();
                    }
                }
            } else if (myPlayer && myPlayer.alive && keysActive()) {
                if (!keys[keyNum]) {
                    keys[keyNum] = 1;
                    if (keyNum == 69) {
                        ePress = !ePress;
                    } else if (keyNum == 67) {
                        updateMapMarker();
                    } else if (keyNum == 88) {
                        sendLockDir();
                    } else if (myPlayer.weapons[keyNum - 49] != undefined) {
                        keyCodeWeapon = myPlayer.weapons[keyNum - 49];
                    } else if (myPlayer.items[keyNum - 49 - myPlayer.weapons.length] != undefined) {
                        selectToBuild(myPlayer.items[keyNum - 49 - myPlayer.weapons.length]);
                    } else if (keyNum == 82) {
                        sendMapPing();
                    } else if (keyNum == 32) {
                        attackState = 1;
                        sendAtckState();
                    } else if (keyStr === window.vars.keyAutoMills) {
                        autoMills = !autoMills;
                    } else if (keyNum == 81) {
                        qPress = true;
                    } else if (keyStr === window.vars.keyAutoGrind) {
                        gPressed = !gPressed;
                    } else if (event.key == "T") {
                        window.vars.velocityTick = !window.vars.velocityTick;
                        const oneFrameStatus = window.vars.velocityTick ? "on" : "off";
                        sendChat(`velotick: ${(oneFrameStatus)}`);
                    } else if (keyStr === window.vars.keyPlaceSpike) {
                        spikePress = true;
                    } else if (keyStr === window.vars.keyPlaceTrap) {
                        trapPress = true;
                    } else if (keyStr === window.vars.keyPlaceTurret) {
                        turretPress = true;
                    }
                    else if (keyStr === window.vars.keyPathBreak) {
                        pathBreak = !pathBreak
                    }
                }
            }
        }
        window.addEventListener('keydown', UTILS.checkTrusted(keyDown));
        function keyUp(event) {
            let keyStr = event.code ?? ""; // <-- ADDED ?? "" HERE
            if (keyStr.startsWith("Key")) keyStr = keyStr.slice(3);
            if (keyStr.startsWith("Digit")) keyStr = keyStr.slice(5);
            keyStr = keyStr.toUpperCase();
            if (myPlayer && myPlayer.alive) {
                var keyNum = event.which || event.keyCode || 0;
                if (keyNum == 13) {
                    toggleChat();
                } else if (keysActive()) {
                    if (keys[keyNum]) {
                        keys[keyNum] = 0;
                        if (keyNum == 32) {
                            attackState = 0;
                            sendAtckState();
                        } else if (keyNum == 81) {
                            qPress = true;
                        }
                        else if(keyStr === window.vars.keyPlaceSpike) {
                            spikePress = false;
                        }
                        else if(keyStr === window.vars.keyPlaceTrap) {
                            trapPress = false;
                        }
                        else if(keyStr === window.vars.keyPlaceTurret) {
                            turretPress = false;
                        }
                    }
                }
            }
        }
        window.addEventListener('keyup', UTILS.checkTrusted(keyUp));
        function sendAtckState() {
            if (myPlayer && myPlayer.alive) {
                io.send("F", attackState, (myPlayer.buildIndex >= 0 ? getAttackDir() : null));
            }
        }
        var lastMoveDir = undefined;
        function sendMoveDir() {
            var newMoveDir = getMoveDir();
            if (lastMoveDir == undefined || newMoveDir == undefined || Math.abs(newMoveDir - lastMoveDir) > 0.3) {
                io.send("9", newMoveDir);
                lastMoveDir = newMoveDir;
            }
        }
        function sendLockDir() {
            myPlayer.lockDir = myPlayer.lockDir ? 0 : 1;
            io.send("K", 0);
        }
        function sendMapPing() {
            io.send("S", 1);
        }
        function sendAutoGather() {
            autogathering = !autogathering;
            io.send("K", 1);
        }
        function selectToBuild(index) {
            io.send("z", index, false);
        }
        function selectWeapon(index, isPlace) {
            io.send("z", index, true);
        }
        function sendAtck(id, angle) {
            io.send("F", id, angle);
        }

        function enterGame() {

            saveVal("moo_name", nameInput.value);
            if (!inGame && socketReady()) {
                inGame = true;
                Sound.stop("menu");
                showLoadingText("Loading...");
                io.send("M", {
                    name: nameInput.value,  // Use the fresh value
                    moofoll: moofoll,
                    skin: skinColor
                });
                let cookie = document.getElementById("ot-sdk-btn-floating");
                if (cookie) {
                    cookie.style.display = "none";
                }
            }
        }

        // SETUP GAME:
        var firstSetup = true;
        function setupGame(yourSID) {
            loadingText.style.display = "none";
            menuCardHolder.style.display = "block";
            mainMenu.style.display = "none";
            keys = {};
            myPlayerSID = yourSID;
            attackState = 0;
            inGame = true;
            if (firstSetup) {
                firstSetup = false;
                gameObjects.length = 0;
            }
        }

        // SHOW ANIM TEXT:
        function showText(x, y, value, type) {
            textManager.showText(x, y, 50, 0.18, 500, Math.abs(value), (value >= 0) ? "#fff" : "#8ecc51");
        }

        // KILL PLAYER:
        var deathTextScale = 99999;
        function killPlayer() {
            inGame = false;
            myPlayer.alive = false;

            try {
                factorem.refreshAds([2], true);
            } catch (e) { };
            gameUI.style.display = "none";
            hideAllWindows();
            lastDeath = {
                x: myPlayer.x,
                y: myPlayer.y
            };
            loadingText.style.display = "none";
            diedText.style.display = "block";
            diedText.style.fontSize = "0px";
            deathTextScale = 0;
            setTimeout(function () {
                menuCardHolder.style.display = "block";
                mainMenu.style.display = "block";
                // Sound.play("menu", 1, true);
                diedText.style.display = "none";
            }, config.deathFadeout);
        }

        // KILL ALL OBJECTS BY A PLAYER:
        function killObjects(sid) {
            if (myPlayer) objectManager.removeAllItems(sid);
        }

        // KILL OBJECT:
        function killObject(sid) {
            removedObjects.push(sid);
            // Before disableBySid: it removes the object from gameObjects
            // outright, so this is the last moment its position and type
            // exist to be read.
            noteVacated(gameObjects.find(object => object.sid == sid));
            objectManager.disableBySid(sid);
        }

        // UPDATE SCORE DISPLAY:
        function updateStatusDisplay() {
            scoreDisplay.innerText = myPlayer.points;
            foodDisplay.innerText = myPlayer.food;;
            woodDisplay.innerText = myPlayer.wood;
            stoneDisplay.innerText = myPlayer.stone;
            killCounter.innerText = myPlayer.kills;
        }

        // ICONS:
        var iconSprites = {};
        var icons = ["crown", "skull"];
        function loadIcons() {
            for (var i = 0; i < icons.length; ++i) {
                var tmpSprite = new Image();
                tmpSprite.onload = function () {
                    this.isLoaded = true;
                };
                tmpSprite.src = ".././img/icons/" + icons[i] + ".png";
                iconSprites[icons[i]] = tmpSprite;
            }
        }

        // UPDATE UPGRADES:
        var tmpList = [];
        function updateUpgrades(points, age) {
            myPlayer.upgradePoints = points;
            myPlayer.upgrAge = age;
            if (points > 0) {
                tmpList.length = 0;
                UTILS.removeAllChildren(upgradeHolder);
                for (var i = 0; i < items.weapons.length; ++i) {
                    if (items.weapons[i].age == age && (items.weapons[i].pre == undefined || myPlayer.weapons.indexOf(items.weapons[i].pre) >= 0)) {
                        var e = UTILS.generateElement({
                            id: "upgradeItem" + i,
                            class: "actionBarItem",
                            onmouseout: function () { showItemInfo(); },
                            parent: upgradeHolder
                        });
                        e.style.backgroundImage = document.getElementById("actionBarItem" + i).style.backgroundImage;
                        tmpList.push(i);
                    }
                }
                for (var i = 0; i < items.list.length; ++i) {
                    if (items.list[i].age == age && (items.list[i].pre == undefined || myPlayer.items.indexOf(items.list[i].pre) >= 0)) {
                        var tmpI = (items.weapons.length + i);
                        var e = UTILS.generateElement({
                            id: "upgradeItem" + tmpI,
                            class: "actionBarItem",
                            onmouseout: function () { showItemInfo(); },
                            parent: upgradeHolder
                        });
                        e.style.backgroundImage = document.getElementById("actionBarItem" + tmpI).style.backgroundImage;
                        tmpList.push(tmpI);
                    }
                }
                for (var i = 0; i < tmpList.length; i++) {
                    (function (i) {
                        var tmpItem = document.getElementById('upgradeItem' + i);
                        tmpItem.onmouseover = function () {
                            if (items.weapons[i]) {
                                showItemInfo(items.weapons[i], true);
                            } else {
                                showItemInfo(items.list[i - items.weapons.length]);
                            }
                        };
                        tmpItem.onclick = UTILS.checkTrusted(function () {
                            io.send("H", i);
                        });
                        UTILS.hookTouchEvents(tmpItem);
                    })(tmpList[i]);
                }
                if (tmpList.length) {
                    upgradeHolder.style.display = "block";
                    upgradeCounter.style.display = "block";
                    upgradeCounter.innerHTML = "SELECT ITEMS (" + points + ")";
                } else {
                    upgradeHolder.style.display = "none";
                    upgradeCounter.style.display = "none";
                    showItemInfo();
                }
            } else {
                upgradeHolder.style.display = "none";
                upgradeCounter.style.display = "none";
                showItemInfo();
            }
        }
        function sendUpgrade(index) {
            io.send("H", index);
        }

        // UPDATE AGE:
        function updateAge(xp, mxp, age) {
            if (xp != undefined) myPlayer.XP = xp;
            if (mxp != undefined) myPlayer.maxXP = mxp;
            if (age != undefined) myPlayer.age = age;

            age == config.maxAge ? (ageText.innerHTML = "MAX AGE",
                                    ageBarBody.style.width = "100%") : (ageText.innerHTML = "AGE " + myPlayer.age,
                                                                        ageBarBody.style.width = myPlayer.XP / myPlayer.maxXP * 100 + "%")
            /*
                if (age == config.maxAge) {
                    ageText.innerHTML = "MAX AGE";
                } else {
                    ageText.innerHTML = "AGE " + player.age;
                }
                */
        }

        // UPDATE LEADERBOARD:
        function updateLeaderboard(data) {
            UTILS.removeAllChildren(leaderboardData);
            var tmpC = 1;
            for (var i = 0; i < data.length; i += 3) {
                (function (i) {
                    UTILS.generateElement({
                        class: "leaderHolder",
                        parent: leaderboardData,
                        children: [
                            UTILS.generateElement({
                                class: "leaderboardItem",
                                style: "color:" + ((data[i] == myPlayerSID) ? "#fff" : "rgba(255,255,255,0.6)"),
                                text: tmpC + ". " + (data[i + 1] != "" ? data[i + 1] : "unknown")
                            }),
                            UTILS.generateElement({
                                class: "leaderScore",
                                text: UTILS.kFormat(data[i + 2]) || "0"
                            })
                        ]
                    });
                })(i);
                tmpC++;
            }
        }

        // UPDATE GAME:
        function updateGame() {
            if (true) {

                // UPDATE DIRECTION:
                /*
                    if (player) {
                        if (!lastSent || now - lastSent >= (1000 / config.clientSendRate)) {
                            lastSent = now;
                            let atckDir = getAttackDir();
                            if (lessDir !== atckDir) {
                                lessDir = atckDir;
                                io.send("D", atckDir);
                            }
                            tmpAttackDir = atckDir;
                        }
                    }
                    */

                // DEATH TEXT:
                if (deathTextScale < 120) {
                    deathTextScale += 0.1 * delta;
                    diedText.style.fontSize = Math.min(Math.round(deathTextScale), 120) + "px";
                }

                // MOVE CAMERA:
                if (myPlayer) {
                    let tmpDist = UTILS.getDistance(camX, camY, myPlayer.x, myPlayer.y);
                    let tmpDir = UTILS.getDirection(myPlayer.x, myPlayer.y, camX, camY);
                    let camSpd = Math.min(tmpDist * 0.0093 * delta, tmpDist);
                    if (tmpDist > 0.05) {
                        camX += camSpd * Math.cos(tmpDir);
                        camY += camSpd * Math.sin(tmpDir);
                    } else {
                        camX = myPlayer.x;
                        camY = myPlayer.y;
                    }
                } else {
                    camX = config.mapScale / 2 + config.riverWidth;
                    camY = config.mapScale / 2;
                }

                // INTERPOLATE PLAYERS AND AI:
                let lastTime = now - (1000 / config.serverUpdateRate);
                let tmpDiff;
                for (let i = 0; i < players.length + ais.length; ++i) {
                    tmpObj = players[i] || ais[i - players.length];
                    if (tmpObj && tmpObj.visible) {
                        if (tmpObj.forcePos) {
                            tmpObj.x = tmpObj.x2;
                            tmpObj.y = tmpObj.y2;
                            tmpObj.dir = tmpObj.d2;
                        } else {
                            let total = tmpObj.t2 - tmpObj.t1;
                            let fraction = lastTime - tmpObj.t1;
                            let ratio = (fraction / total);
                            let rate = 170;
                            tmpObj.dt += delta;
                            let tmpRate = Math.min(1.7, tmpObj.dt / rate);
                            tmpDiff = (tmpObj.x2 - tmpObj.x1);
                            tmpObj.x = tmpObj.x1 + (tmpDiff * tmpRate);
                            tmpDiff = (tmpObj.y2 - tmpObj.y1);
                            tmpObj.y = tmpObj.y1 + (tmpDiff * tmpRate);
                            tmpObj.dir = Math.lerpAngle(tmpObj.d2, tmpObj.d1, Math.min(1.2, ratio));
                        }
                    }
                }

                // RENDER CORDS:
                xOffset = camX - (maxScreenWidth / 2);
                yOffset = camY - (maxScreenHeight / 2);

                // RENDER BACKGROUND:
                if (config.snowBiomeTop - yOffset <= 0 && config.mapScale - config.snowBiomeTop - yOffset >= maxScreenHeight) {
                    mainContext.fillStyle = "#b6db66";
                    mainContext.fillRect(0, 0, maxScreenWidth, maxScreenHeight);
                } else if (config.mapScale - config.snowBiomeTop - yOffset <= 0) {
                    mainContext.fillStyle = "#dbc666";
                    mainContext.fillRect(0, 0, maxScreenWidth, maxScreenHeight);
                } else if (config.snowBiomeTop - yOffset >= maxScreenHeight) {
                    mainContext.fillStyle = "#fff";
                    mainContext.fillRect(0, 0, maxScreenWidth, maxScreenHeight);
                } else if (config.snowBiomeTop - yOffset >= 0) {
                    mainContext.fillStyle = "#fff";
                    mainContext.fillRect(0, 0, maxScreenWidth, config.snowBiomeTop - yOffset);
                    mainContext.fillStyle = "#b6db66";
                    mainContext.fillRect(0, config.snowBiomeTop - yOffset, maxScreenWidth,
                                         maxScreenHeight - (config.snowBiomeTop - yOffset));
                } else {
                    mainContext.fillStyle = "#b6db66";
                    mainContext.fillRect(0, 0, maxScreenWidth,
                                         (config.mapScale - config.snowBiomeTop - yOffset));
                    mainContext.fillStyle = "#dbc666";
                    mainContext.fillRect(0, (config.mapScale - config.snowBiomeTop - yOffset), maxScreenWidth,
                                         maxScreenHeight - (config.mapScale - config.snowBiomeTop - yOffset));
                }

                // RENDER WATER AREAS:
                if (!firstSetup) {
                    waterMult += waterPlus * config.waveSpeed * delta;
                    if (waterMult >= config.waveMax) {
                        waterMult = config.waveMax;
                        waterPlus = -1;
                    } else if (waterMult <= 1) {
                        waterMult = waterPlus = 1;
                    }
                    mainContext.globalAlpha = 1;
                    mainContext.fillStyle = "#dbc666";
                    renderWaterBodies(xOffset, yOffset, mainContext, config.riverPadding);
                    mainContext.fillStyle = "#91b2db";
                    renderWaterBodies(xOffset, yOffset, mainContext, (waterMult - 1) * 250);
                }

                // RENDER GRID:
                /*
                    mainContext.lineWidth = 4;
                    mainContext.strokeStyle = "#000";
                    mainContext.globalAlpha = 0.06;
                    mainContext.beginPath();
                    for (var x = -camX; x < maxScreenWidth; x += maxScreenHeight / 18) {
                        if (x > 0) {
                            mainContext.moveTo(x, 0);
                            mainContext.lineTo(x, maxScreenHeight);
                        }
                    }
                    for (var y = -camY; y < maxScreenHeight; y += maxScreenHeight / 18) {
                        if (x > 0) {
                            mainContext.moveTo(0, y);
                            mainContext.lineTo(maxScreenWidth, y);
                        }
                    }
                    mainContext.stroke();
                    */

                // RENDER BOTTOM LAYER:
                mainContext.globalAlpha = 1;
                mainContext.strokeStyle = outlineColor;
                renderGameObjects(-1, xOffset, yOffset);

                // RENDER PROJECTILES:
                mainContext.globalAlpha = 1;
                mainContext.lineWidth = outlineWidth;
                renderProjectiles(0, xOffset, yOffset);

                // RENDER VELOCITY POSITION
                /*
                    if(myPlayer && myPlayer.alive){
                        mainContext.globalAlpha = 0.5;

                        mainContext.save();
                        mainContext.translate(myPlayer.xVel - xOffset, myPlayer.yVel - yOffset);

                        mainContext.rotate(myPlayer.dir);
                        renderPlayer(myPlayer, mainContext);
                        mainContext.restore();

                        mainContext.globalAlpha = 1;
                    }
                    */



                // RENDER PLAYERS:
                renderPlayers(xOffset, yOffset, 0);

                // RENDER AI:
                mainContext.globalAlpha = 1;
                for (var i = 0; i < ais.length; ++i) {
                    tmpObj = ais[i];
                    if (tmpObj.active && tmpObj.visible) {
                        tmpObj.animate(delta);
                        mainContext.save();
                        mainContext.translate(tmpObj.x - xOffset, tmpObj.y - yOffset);
                        mainContext.rotate(tmpObj.dir + tmpObj.dirPlus - (Math.PI / 2));
                        renderAI(tmpObj, mainContext);
                        mainContext.restore();
                    }
                }

                // RENDER GAME OBJECTS (LAYERED):
                renderGameObjects(0, xOffset, yOffset);
                renderProjectiles(1, xOffset, yOffset);
                renderGameObjects(1, xOffset, yOffset);
                renderPlayers(xOffset, yOffset, 1);
                renderGameObjects(2, xOffset, yOffset);
                renderGameObjects(3, xOffset, yOffset);

                // MAP BOUNDARIES:
                mainContext.fillStyle = "#000";
                mainContext.globalAlpha = 0.09;
                if (xOffset <= 0) {
                    mainContext.fillRect(0, 0, -xOffset, maxScreenHeight);
                } if (config.mapScale - xOffset <= maxScreenWidth) {
                    var tmpY = Math.max(0, -yOffset);
                    mainContext.fillRect(config.mapScale - xOffset, tmpY, maxScreenWidth - (config.mapScale - xOffset), maxScreenHeight - tmpY);
                } if (yOffset <= 0) {
                    mainContext.fillRect(-xOffset, 0, maxScreenWidth + xOffset, -yOffset);
                } if (config.mapScale - yOffset <= maxScreenHeight) {
                    var tmpX = Math.max(0, -xOffset);
                    var tmpMin = 0;
                    if (config.mapScale - xOffset <= maxScreenWidth)
                        tmpMin = maxScreenWidth - (config.mapScale - xOffset);
                    mainContext.fillRect(tmpX, config.mapScale - yOffset,
                                         (maxScreenWidth - tmpX) - tmpMin, maxScreenHeight - (config.mapScale - yOffset));
                }

                renderEnemyTraps(xOffset, yOffset);
                for (let object of predictObjects) {
                    mainContext.globalAlpha = .6;

                    mainContext.save();
                    mainContext.translate(object.x - xOffset, object.y - yOffset);

                    let image = getItemSprite({ id: object.id, name: object.name, scale: object.scale, prediction: true, preplace: object.preplace });
                    mainContext.drawImage(image, -(image.width / 2), -(image.height / 2));

                    mainContext.rotate(object.angle);
                    mainContext.restore();
                }

                for (let i in visibleObjects) {
                    let object = visibleObjects[i];

                    if (UTILS.getDistance(myPlayer.x, myPlayer.y, object.x, object.y) < 300 && object.isItem) {
                        let radius = object.id > 5 && object.id < 10 ? 33 : 21;

                        let hpPercent = Math.max(0, Math.min(object.health / object.maxHealth, 1));
                        let healthArc = hpPercent * Math.PI * 2;

                        let isMine = object.owner.sid == myPlayer.sid;
                        let isTeammate = isAlly(object.owner.sid);
                        let isEnemy = !isMine && !isTeammate;

                        let color = isMine
                        ? "#00FF00"
                        : isTeammate
                        ? "#0000ff"
                        : "#ff0000";

                        // Thickness control
                        let outlineWidth = isEnemy ? 10 : isTeammate ? 7 : 5;
                        let hpWidth = isEnemy ? 7 : isTeammate ? 4 : 4;

                        mainContext.globalAlpha = 1;
                        mainContext.lineCap = "round";

                        // Outline (thicker for enemies)
                        mainContext.strokeStyle = darkOutlineColor;
                        mainContext.lineWidth = outlineWidth;
                        mainContext.beginPath();
                        mainContext.arc(object.x - xOffset, object.y - yOffset, radius, 0, healthArc);
                        mainContext.stroke();

                        // HP arc (also thicker for enemies)
                        mainContext.strokeStyle = color;
                        mainContext.lineWidth = hpWidth;
                        mainContext.beginPath();
                        mainContext.arc(object.x - xOffset, object.y - yOffset, radius, 0, healthArc);
                        mainContext.stroke();
                    }
                }
                // RENDER DAY/NIGHT TIME (Dark Purple/Blue Vignette)

                mainContext.globalAlpha = 1;
                const gradient = mainContext.createRadialGradient(
                    maxScreenWidth / 2, maxScreenHeight / 2, 0,
                    maxScreenWidth / 2, maxScreenHeight / 2, maxScreenWidth / 2 );
                // purple/blue tint instead of pure black
                gradient.addColorStop(0, "rgba(30, 30, 100, 0.40)");
                gradient.addColorStop(0.5, "rgba(30, 30, 80, 0.58)");
                gradient.addColorStop(1, "rgba(10, 10, 60, 0.60)");
                mainContext.fillStyle = gradient;
                mainContext.fillRect(0, 0, maxScreenWidth, maxScreenHeight);

                // FROM HERE

                // RENDER PLAYER AND AI UI / PLAYERINFOS:
                mainContext.strokeStyle = darkOutlineColor;
                for (var i = 0; i < players.length + ais.length; ++i) {
                    tmpObj = players[i] || ais[i - players.length];
                    if (tmpObj.visible) {

                        // NAME AND HEALTH:
                        if (tmpObj.skinIndex != 10 || (tmpObj == myPlayer) || (tmpObj.team && tmpObj.team == myPlayer.team)) {
                            var tmpText = (tmpObj.team ? `[${tmpObj.team}] ` : ``) + (tmpObj.name || ``);
                            if (tmpText != "") {
                                mainContext.font = (tmpObj.nameScale || 30) + "px Hammersmith One";
                                mainContext.fillStyle = "#fff";
                                mainContext.textBaseline = "middle";
                                mainContext.textAlign = "center";
                                mainContext.lineWidth = (tmpObj.nameScale ? 11 : 8);
                                mainContext.lineJoin = "round";
                                mainContext.strokeText(tmpText, tmpObj.x - xOffset, (tmpObj.y - yOffset - tmpObj.scale) - config.nameY);
                                mainContext.fillText(tmpText, tmpObj.x - xOffset, (tmpObj.y - yOffset - tmpObj.scale) - config.nameY);
                                if (tmpObj.isLeader && iconSprites["crown"].isLoaded) {
                                    var tmpS = config.crownIconScale;
                                    var tmpX = tmpObj.x - xOffset - (tmpS / 2) - (mainContext.measureText(tmpText).width / 2) - config.crownPad;
                                    mainContext.drawImage(iconSprites["crown"], tmpX, (tmpObj.y - yOffset - tmpObj.scale)
                                                          - config.nameY - (tmpS / 2) - 5, tmpS, tmpS);
                                } if (tmpObj.iconIndex == 1 && iconSprites["skull"].isLoaded) {
                                    var tmpS = config.crownIconScale;
                                    var tmpX = tmpObj.x - xOffset - (tmpS / 2) + (mainContext.measureText(tmpText).width / 2) + config.crownPad;
                                    mainContext.drawImage(iconSprites["skull"], tmpX, (tmpObj.y - yOffset - tmpObj.scale)
                                                          - config.nameY - (tmpS / 2) - 5, tmpS, tmpS);
                                }
                            }


                            if (tmpObj.isPlayer && tmpObj.alive && tmpObj.shameCount !== undefined) {
                                const centerX = tmpObj.x - xOffset;
                                const centerY = tmpObj.y - yOffset;
                                const playerTop = centerY - tmpObj.scale;
                                const hpBarY = playerTop + 120;
                                const shameY = hpBarY + 12;
                                mainContext.save();
                                mainContext.font = "bold 16px Hammersmith One";
                                mainContext.textAlign = "center";
                                mainContext.textBaseline = "middle";
                                mainContext.lineJoin = "round";
                                mainContext.lineWidth = 5;
                                mainContext.strokeStyle = "#000000";
                                mainContext.strokeText(tmpObj.shameCount, centerX, shameY);
                                mainContext.fillStyle = "#ff8c42";
                                mainContext.fillText(tmpObj.shameCount, centerX, shameY);
                                mainContext.restore();
                            }

                            if (tmpObj.isPlayer && tmpObj.alive && tmpObj.sid !== undefined) {
                                const centerX = tmpObj.x - xOffset;
                                const centerY = tmpObj.y - yOffset;
                                mainContext.save();
                                mainContext.font = "bold 18px Hammersmith One";
                                mainContext.textAlign = "center";
                                mainContext.textBaseline = "middle";
                                mainContext.lineWidth = 6;
                                mainContext.strokeStyle = "#5a4516";
                                mainContext.strokeText(tmpObj.sid, centerX, centerY);
                                mainContext.fillStyle = "#fff";
                                mainContext.fillText(tmpObj.sid, centerX, centerY);
                                mainContext.restore();
                            }


                            if (tmpObj.health > 0) {
                                // HEALTH HOLDER:
                                var tmpWidth = config.healthBarWidth;
                                mainContext.fillStyle = darkOutlineColor;
                                mainContext.roundRect(tmpObj.x - xOffset - config.healthBarWidth - config.healthBarPad,
                                                      (tmpObj.y - yOffset + tmpObj.scale) + config.nameY, (config.healthBarWidth * 2) +
                                                      (config.healthBarPad * 2), 17, 8);
                                mainContext.fill();

                                // HEALTH BAR:
                                mainContext.fillStyle = (tmpObj == myPlayer || (tmpObj.team && tmpObj.team == myPlayer.team)) ? "#8ecc51" : "#cc5151";
                                mainContext.roundRect(tmpObj.x - xOffset - config.healthBarWidth,
                                                      (tmpObj.y - yOffset + tmpObj.scale) + config.nameY + config.healthBarPad,
                                                      ((config.healthBarWidth * 2) * (tmpObj.health / tmpObj.maxHealth)), 17 - config.healthBarPad * 2, 7);
                                mainContext.fill();
                            }
                        }
                    }
                }
                // RENDER STUFF
                if (path && path.length > 0) {
                    drawMoveDirection();

                }



                // TO HERE

                // RENDER ANIM TEXTS:
                textManager.update(delta, mainContext, xOffset, yOffset);

                // RENDER CHAT MESSAGES:
                for (var i = 0; i < players.length; ++i) {
                    tmpObj = players[i];
                    if (tmpObj.visible && tmpObj.chatCountdown > 0) {
                        tmpObj.chatCountdown -= delta;
                        if (tmpObj.chatCountdown <= 0)
                            tmpObj.chatCountdown = 0;
                        mainContext.font = "32px Hammersmith One";
                        var tmpSize = mainContext.measureText(tmpObj.chatMessage);
                        mainContext.textBaseline = "middle";
                        mainContext.textAlign = "center";
                        var tmpX = tmpObj.x - xOffset;
                        var tmpY = tmpObj.y - tmpObj.scale - yOffset - 90;
                        var tmpH = 47;
                        var tmpW = tmpSize.width + 17;
                        mainContext.fillStyle = "rgba(0,0,0,0.2)";
                        mainContext.roundRect(tmpX - tmpW / 2, tmpY - tmpH / 2, tmpW, tmpH, 6);
                        mainContext.fill();
                        mainContext.fillStyle = "#fff";
                        mainContext.fillText(tmpObj.chatMessage, tmpX, tmpY);
                    }
                }
            }

            // RENDER MINIMAP:
            renderMinimap(delta);

            // RENDER CONTROLS:
            if (controllingTouch.id !== -1) {
                renderControl(
                    controllingTouch.startX, controllingTouch.startY,
                    controllingTouch.currentX, controllingTouch.currentY
                );
            }
            if (attackingTouch.id !== -1) {
                renderControl(
                    attackingTouch.startX, attackingTouch.startY,
                    attackingTouch.currentX, attackingTouch.currentY
                );
            }
        }

        function renderEnemyTraps(xOffset, yOffset) {
            for (let i in predictEnemyTraps) {
                let object = predictEnemyTraps[i];

                mainContext.save();
                mainContext.translate(object.x - xOffset, object.y - yOffset);
                let image = getItemSprite({ id: object.id, name: items.list[object.id].name, scale: 40, predictEnemyTrap: true });
                mainContext.globalAlpha = .6;
                mainContext.drawImage(image, -(image.width / 2), -(image.height / 2));
                mainContext.restore();
            }
        }

        // RENDER CONTROL:
        function renderControl(startX, startY, currentX, currentY) {
            mainContext.save();
            mainContext.setTransform(1, 0, 0, 1, 0, 0);
            // mainContext.resetTransform();
            mainContext.scale(pixelDensity, pixelDensity);
            var controlRadius = 50;
            mainContext.beginPath();
            mainContext.arc(startX, startY, controlRadius, 0, Math.PI * 2, false);
            mainContext.closePath();
            mainContext.fillStyle = "rgba(255, 255, 255, 0.3)";
            mainContext.fill();
            var offsetX = currentX - startX;
            var offsetY = currentY - startY;
            var mag = Math.sqrt(Math.pow(offsetX, 2) + Math.pow(offsetY, 2));
            var divisor = mag > controlRadius ? (mag / controlRadius) : 1;
            offsetX /= divisor;
            offsetY /= divisor;
            mainContext.beginPath();
            mainContext.arc(startX + offsetX, startY + offsetY, controlRadius * 0.5, 0, Math.PI * 2, false);
            mainContext.closePath();
            mainContext.fillStyle = "white";
            mainContext.fill();
            mainContext.restore();
        }

        // RENDER PROJECTILES:
        function renderProjectiles(layer, xOffset, yOffset) {
            for (var i = 0; i < projectiles.length; ++i) {
                tmpObj = projectiles[i];
                if (tmpObj.active && tmpObj.layer == layer) {
                    tmpObj.update(delta);
                    if (tmpObj.active && isOnScreen(tmpObj.x - xOffset, tmpObj.y - yOffset, tmpObj.scale)) {
                        mainContext.save();
                        mainContext.translate(tmpObj.x - xOffset, tmpObj.y - yOffset);
                        mainContext.rotate(tmpObj.dir);
                        renderProjectile(0, 0, tmpObj, mainContext, 1);
                        mainContext.restore();
                    }
                }
            }
        }

        // RENDER PROJECTILE:
        var projectileSprites = {};
        function renderProjectile(x, y, obj, ctxt, debug) {
            if (obj.src) {
                var tmpSrc = items.projectiles[obj.indx].src;
                var tmpSprite = projectileSprites[tmpSrc];
                if (!tmpSprite) {
                    tmpSprite = new Image();
                    tmpSprite.onload = function () {
                        this.isLoaded = true;
                    }
                    tmpSprite.src = ".././img/weapons/" + tmpSrc + ".png";
                    ctxt.globalAlpha = 0.8;
                    projectileSprites[tmpSrc] = tmpSprite;
                }
                if (tmpSprite.isLoaded)
                    ctxt.drawImage(tmpSprite, x - (obj.scale / 2), y - (obj.scale / 2), obj.scale, obj.scale);
            } else if (obj.indx == 1) {
                ctxt.fillStyle = "#939393";
                renderCircle(x, y, obj.scale, ctxt);
            }
        }

        // RENDER WATER BODIES:
        function renderWaterBodies(xOffset, yOffset, ctxt, padding) {
            // MIDDLE RIVER:
            var tmpW = config.riverWidth + padding;
            var tmpY = (config.mapScale / 2) - yOffset - (tmpW / 2);
            if (tmpY < maxScreenHeight && tmpY + tmpW > 0) {
                ctxt.fillRect(0, tmpY, maxScreenWidth, tmpW);
            }
        }

        // RENDER GAME OBJECTS:
        function renderGameObjects(layer, xOffset, yOffset) {

            var tmpSprite, tmpX, tmpY;

            // ---- NEW: store spike positions ----
            let spikeList = [];

            for (var i = 0; i < gameObjects.length; ++i) {
                tmpObj = gameObjects[i];

                if (tmpObj.active) {

                    tmpX = tmpObj.x + tmpObj.xWiggle - xOffset;
                    tmpY = tmpObj.y + tmpObj.yWiggle - yOffset;

                    // collect spikes (change name if needed later)
                    if (layer == 0 && tmpObj.isItem && tmpObj.name === "spikes") {
                        spikeList.push({x: tmpX, y: tmpY});
                    }

                    if (layer == 0) {
                        tmpObj.update(delta);
                    }

                    if (tmpObj.layer == layer && isOnScreen(tmpX, tmpY, tmpObj.scale + (tmpObj.blocker || 0))) {

                        mainContext.globalAlpha = tmpObj.hideFromEnemy ? 0.6 : 1;

                        if (tmpObj.isItem) {

                            tmpSprite = getItemSprite(tmpObj);

                            mainContext.save();
                            mainContext.translate(tmpX, tmpY);
                            mainContext.rotate(tmpObj.dir);
                            mainContext.drawImage(tmpSprite, -(tmpSprite.width / 2), -(tmpSprite.height / 2));

                            if (tmpObj.blocker) {
                                mainContext.strokeStyle = "#db6e6e";
                                mainContext.globalAlpha = 0.3;
                                mainContext.lineWidth = 6;
                                renderCircle(0, 0, tmpObj.blocker, mainContext, false, true);
                            }

                            mainContext.restore();

                        } else {
                            tmpSprite = getResSprite(tmpObj);
                            mainContext.drawImage(tmpSprite, tmpX - (tmpSprite.width / 2), tmpY - (tmpSprite.height / 2));
                        }
                    }
                }
            }
            if (layer == 0 && spikeList.length > 0) {

                mainContext.save();

                mainContext.shadowBlur = 0;
                mainContext.globalAlpha = 1;

                for (let i = 0; i < spikeList.length; i++) {

                    let sx = Math.round(spikeList[i].x);
                    let sy = Math.round(spikeList[i].y);

                    // main red dot (smaller)
                    mainContext.beginPath();
                    mainContext.fillStyle = "#ff1e1e";
                    mainContext.arc(sx, sy, 3.5, 0, Math.PI * 2);
                    mainContext.fill();

                    // darker inner center
                    mainContext.beginPath();
                    mainContext.fillStyle = "#8b0000";
                    mainContext.arc(sx, sy, 3, 0, Math.PI * 2);
                    mainContext.fill();
                }

                mainContext.restore();
            }
        }
        // GATHER ANIMATION:
        function gatherAnimation(sid, isObjectHit, weapon) {
            tmpObj = findPlayerBySID(sid);
            if (tmpObj) {
                hits.push({ player: tmpObj, isObjectHit: isObjectHit, weapon: weapon });

                if (isObjectHit) {
                    objectHits.push({ objects: damageObjects, player: tmpObj, weapon: weapon });
                    damageObjects = [];
                }

                tmpObj.startAnim(isObjectHit, weapon);
            }
        }

        // RENDER PLAYERS:
        function renderPlayers(xOffset, yOffset, zIndex) {
            mainContext.globalAlpha = 1;
            for (var i = 0; i < players.length; ++i) {
                tmpObj = players[i];
                if (tmpObj.zIndex == zIndex) {
                    tmpObj.animate(delta);
                    if (tmpObj.visible) {
                        tmpObj.skinRot += (0.002 * delta);
                        tmpDir = ((tmpObj == myPlayer) ? getAttackDir() : tmpObj.dir) + tmpObj.dirPlus;
                        mainContext.save();
                        mainContext.translate(tmpObj.x - xOffset, tmpObj.y - yOffset);
                        // RENDER PLAYER:
                        mainContext.rotate(tmpDir);
                        renderPlayer(tmpObj, mainContext);
                        mainContext.restore();
                    }
                }
            }
        }

        // RENDER PLAYER:
        function renderPlayer(obj, ctxt) {
            ctxt = ctxt || mainContext;
            ctxt.lineWidth = outlineWidth;
            ctxt.lineJoin = "miter";
            var handAngle = (Math.PI / 4) * (items.weapons[obj.weaponIndex].armS || 1);
            var oHandAngle = (obj.buildIndex < 0) ? (items.weapons[obj.weaponIndex].hndS || 1) : 1;
            var oHandDist = (obj.buildIndex < 0) ? (items.weapons[obj.weaponIndex].hndD || 1) : 1;

            // TAIL/CAPE:
            if (obj.tailIndex > 0) {
                renderTail(obj.tailIndex, ctxt, obj);
            }

            // WEAPON BELLOW HANDS:
            if (obj.buildIndex < 0 && !items.weapons[obj.weaponIndex].aboveHand) {
                renderTool(items.weapons[obj.weaponIndex], config.weaponVariants[obj.weaponVariant].src, obj.scale, 0, ctxt);
                if (items.weapons[obj.weaponIndex].projectile != undefined && !items.weapons[obj.weaponIndex].hideProjectile) {
                    renderProjectile(obj.scale, 0,
                                     items.projectiles[items.weapons[obj.weaponIndex].projectile], mainContext);
                }
            }

            // HANDS:
            ctxt.fillStyle = config.skinColors[obj.skinColor];
            renderCircle(obj.scale * Math.cos(handAngle), (obj.scale * Math.sin(handAngle)), 14);
            renderCircle((obj.scale * oHandDist) * Math.cos(-handAngle * oHandAngle),
                         (obj.scale * oHandDist) * Math.sin(-handAngle * oHandAngle), 14);

            // WEAPON ABOVE HANDS:
            if (obj.buildIndex < 0 && items.weapons[obj.weaponIndex].aboveHand) {
                renderTool(items.weapons[obj.weaponIndex], config.weaponVariants[obj.weaponVariant].src, obj.scale, 0, ctxt);
                if (items.weapons[obj.weaponIndex].projectile != undefined && !items.weapons[obj.weaponIndex].hideProjectile) {
                    renderProjectile(obj.scale, 0,
                                     items.projectiles[items.weapons[obj.weaponIndex].projectile], mainContext);
                }
            }

            // BUILD ITEM:
            if (obj.buildIndex >= 0) {
                var tmpSprite = getItemSprite(items.list[obj.buildIndex]);
                ctxt.drawImage(tmpSprite, obj.scale - items.list[obj.buildIndex].holdOffset, -tmpSprite.width / 2);
            }

            // BODY:
            ctxt.globalAlpha = 0.7;
            renderCircle(0, 0, obj.scale, ctxt);
            ctxt.globalAlpha = 0.7;


            // SKIN:
            if (obj.skinIndex > 0) {
                ctxt.rotate(Math.PI / 2);
                renderSkin(obj.skinIndex, ctxt, null, obj);
            }
        }

        // RENDER SKINS:
        var skinSprites = {};
        var skinPointers = {};
        var tmpSkin;
        function renderSkin(index, ctxt, parentSkin, owner) {
            tmpSkin = skinSprites[index];
            if (!tmpSkin) {
                var tmpImage = new Image();
                tmpImage.onload = function () {
                    this.isLoaded = true;
                    this.onload = null;
                };
                tmpImage.src = ".././img/hats/hat_" + index + ".png";
                skinSprites[index] = tmpImage;
                tmpSkin = tmpImage;
            }
            var tmpObj = parentSkin || skinPointers[index];
            if (!tmpObj) {
                for (var i = 0; i < hats.length; ++i) {
                    if (hats[i].id == index) {
                        tmpObj = hats[i];
                        break;
                    }
                }
                skinPointers[index] = tmpObj;
            }
            if (tmpSkin.isLoaded)
                ctxt.drawImage(tmpSkin, -tmpObj.scale / 2, -tmpObj.scale / 2, tmpObj.scale, tmpObj.scale);
            if (!parentSkin && tmpObj.topSprite) {
                ctxt.save();
                ctxt.rotate(owner.skinRot);
                renderSkin(index + "_top", ctxt, tmpObj, owner);
                ctxt.restore();
            }
        }

        // RENDER TAIL:
        var accessSprites = {};
        var accessPointers = {};
        function renderTail(index, ctxt, owner) {
            tmpSkin = accessSprites[index];
            if (!tmpSkin) {
                var tmpImage = new Image();
                tmpImage.onload = function () {
                    this.isLoaded = true;
                    this.onload = null;
                };
                tmpImage.src = ".././img/accessories/access_" + index + ".png";
                accessSprites[index] = tmpImage;
                tmpSkin = tmpImage;
            }
            var tmpObj = accessPointers[index];
            if (!tmpObj) {
                for (var i = 0; i < accessories.length; ++i) {
                    if (accessories[i].id == index) {
                        tmpObj = accessories[i];
                        break;
                    }
                }
                accessPointers[index] = tmpObj;
            }
            if (tmpSkin.isLoaded) {
                ctxt.save();
                ctxt.translate(-20 - (tmpObj.xOff || 0), 0);
                if (tmpObj.spin)
                    ctxt.rotate(owner.skinRot);
                ctxt.drawImage(tmpSkin, -(tmpObj.scale / 2), -(tmpObj.scale / 2), tmpObj.scale, tmpObj.scale);
                ctxt.restore();
            }
        }

        // RENDER TOOL:
        var toolSprites = {};
        function renderTool(obj, variant, x, y, ctxt) {
            var tmpSrc = obj.src + (variant || "");
            var tmpSprite = toolSprites[tmpSrc];
            if (!tmpSprite) {
                tmpSprite = new Image();
                tmpSprite.onload = function () {
                    this.isLoaded = true;
                }
                tmpSprite.src = ".././img/weapons/" + tmpSrc + ".png";
                toolSprites[tmpSrc] = tmpSprite;
            }
            if (tmpSprite.isLoaded)
                ctxt.drawImage(tmpSprite, x + obj.xOff - (obj.length / 2), y + obj.yOff - (obj.width / 2), obj.length, obj.width);
        }

        // Call this in your tree rendering loop, BEFORE rendering the tree itself
        // Example usage:
        /*
for (let tree of trees) {
    renderTreeShadow(tree, tmpContext, xOffset, yOffset);
    // Then render the actual tree
    renderTree(tree, tmpContext, xOffset, yOffset);
}
*/
        // RENDER GAME OBJECTS:
        var gameObjectSprites = {};
        function getResSprite(obj) {
            var biomeID = (obj.y >= config.mapScale - config.snowBiomeTop) ? 2 : ((obj.y <= config.snowBiomeTop) ? 1 : 0);
            var tmpIndex = (obj.type + "" + obj.scale + "" + biomeID);
            var tmpSprite = gameObjectSprites[tmpIndex];
            if (!tmpSprite) {
                var tmpCanvas = document.createElement('canvas');
                // Увеличиваем размер холста, чтобы тень влезла снизу
                tmpCanvas.width = tmpCanvas.height = (obj.scale * 2.4) + outlineWidth;
                var tmpContext = tmpCanvas.getContext('2d');
                tmpContext.translate((tmpCanvas.width / 2), (tmpCanvas.height / 2));
                tmpContext.rotate(UTILS.randFloat(0, Math.PI));

                // --- ЛЕГКИЕ ТЕНИ СНИЗУ ---
                tmpContext.shadowColor = "rgba(0, 0, 0, 0.25)"; // Сделана более прозрачной
                tmpContext.shadowBlur = 1;                    // Увеличено размытие для плавности
                tmpContext.shadowOffsetX = 0;                  // Не смещаем вбок
                tmpContext.shadowOffsetY = 30;                 // Опускаем строго вниз
                // -------------------------

                // Если outlineColor и outlineWidth рисуют обводку, которая мешает
                // Закомментируйте или удалите эти строки, если вам нужна только тень
                // tmpContext.strokeStyle = outlineColor;
                // tmpContext.lineWidth = outlineWidth;
                let colors = [
                    ["#b1d959", "#95b946"],
                    ["#bade6e", "#aac76b"],
                    ["#a7d544", "#86a63f"],
                    ["#b4db62", "#9ebf57"]
                ]
                let select = colors[Math.floor(Math.random() * colors.length)];
                if (obj.type == 0) {
                    var tmpScale;
                    for (var i = 0; i < 2; ++i) {
                        tmpScale = tmpObj.scale * (!i ? 1 : 0.5);
                        renderStar(tmpContext, 7, tmpScale, tmpScale * 0.7);
                        tmpContext.fillStyle = !biomeID ? (!i ? "#9ebf57" : "#b4db62") : (!i ? "#e3f1f4" : "#fff");
                        tmpContext.fill();
                        if (!i)
                            tmpContext.stroke();
                    }
                } else if (obj.type == 1) {
                    if (biomeID == 2) {
                        tmpContext.fillStyle = "#606060";
                        renderStar(tmpContext, 6, obj.scale * 0.3, obj.scale * 0.71);
                        tmpContext.fill();
                        tmpContext.stroke();
                        tmpContext.fillStyle = "#89a54c";
                        renderCircle(0, 0, obj.scale * 0.55, tmpContext);
                        tmpContext.fillStyle = "#a5c65b";
                        renderCircle(0, 0, obj.scale * 0.3, tmpContext, true);
                    } else {
                        renderBlob(tmpContext, 6, tmpObj.scale, tmpObj.scale * 0.7);
                        tmpContext.fillStyle = biomeID ? "#e3f1f4" : "#89a54c";
                        tmpContext.fill();
                        tmpContext.stroke();
                        tmpContext.fillStyle = biomeID ? "#6a64af" : "#c15555";
                        var tmpRange;
                        var berries = 4;
                        var rotVal = mathPI2 / berries;
                        for (var i = 0; i < berries; ++i) {
                            tmpRange = UTILS.randInt(tmpObj.scale / 3.5, tmpObj.scale / 2.3);
                            renderCircle(tmpRange * Math.cos(rotVal * i), tmpRange * Math.sin(rotVal * i),
                                         UTILS.randInt(10, 12), tmpContext);
                        }
                    }
                } else if (obj.type == 2 || obj.type == 3) {
                    tmpContext.fillStyle = (obj.type == 2) ? (biomeID == 2 ? "#938d77" : "#939393") : "#e0c655";
                    renderStar(tmpContext, 3, obj.scale, obj.scale);
                    tmpContext.fill();
                    tmpContext.stroke();
                    tmpContext.fillStyle = (obj.type == 2) ? (biomeID == 2 ? "#b2ab90" : "#bcbcbc") : "#ebdca3";
                    renderStar(tmpContext, 3, obj.scale * 0.55, obj.scale * 0.65);
                    tmpContext.fill();
                }
                tmpSprite = tmpCanvas;
                gameObjectSprites[tmpIndex] = tmpSprite;
            }
            return tmpSprite;
        }
        // RENDER HEALTH CIRCLE:
        function renderHealthCircle(x, y, scale, tmpContext, dontStroke, dontFill) {
            tmpContext = tmpContext || mainContext;
            tmpContext.beginPath();
            tmpContext.arc(x, y, scale, 0, 2 * Math.PI);
            if (!dontFill) tmpContext.fill();
            if (!dontStroke) tmpContext.stroke();
        }
        // GET ITEM SPRITE:
        var itemSprites = [];
        function getItemSprite(obj, asIcon) {
            var tmpSprite = itemSprites[obj.id + (obj.predictEnemyTrap ? 100 : (obj.prediction ? (obj.preplace ? 200 : 300) : 0))];
            if (!tmpSprite || asIcon) {
                var tmpCanvas = document.createElement('canvas');
                tmpCanvas.width = tmpCanvas.height = (obj.scale * 2.5) + outlineWidth +
                    (items.list[obj.id].spritePadding || 0);
                var tmpContext = tmpCanvas.getContext('2d');
                tmpContext.translate((tmpCanvas.width / 2), (tmpCanvas.height / 2));
                tmpContext.rotate(asIcon ? 0 : (Math.PI / 2));
                tmpContext.strokeStyle = obj.prediction ? obj.preplace ? "#00FFFF" : "#00FFFF" : outlineColor;
                tmpContext.lineWidth = outlineWidth * (asIcon ? (tmpCanvas.width / 81) : 1);
                if (obj.name == "apple") {
                    tmpContext.fillStyle = "#c15555";
                    renderCircle(0, 0, obj.scale, tmpContext);
                    tmpContext.fillStyle = "#89a54c";
                    var leafDir = -(Math.PI / 2);
                    renderLeaf(obj.scale * Math.cos(leafDir), obj.scale * Math.sin(leafDir),
                               25, leafDir + Math.PI / 2, tmpContext);
                } else if (obj.name == "cookie") {
                    tmpContext.fillStyle = "#cca861";
                    renderCircle(0, 0, obj.scale, tmpContext);
                    tmpContext.fillStyle = "#937c4b";
                    var chips = 4;
                    var rotVal = mathPI2 / chips;
                    var tmpRange;
                    for (var i = 0; i < chips; ++i) {
                        tmpRange = UTILS.randInt(obj.scale / 2.5, obj.scale / 1.7);
                        renderCircle(tmpRange * Math.cos(rotVal * i), tmpRange * Math.sin(rotVal * i),
                                     UTILS.randInt(4, 5), tmpContext, true);
                    }
                } else if (obj.name == "cheese") {
                    tmpContext.fillStyle = "#f4f3ac";
                    renderCircle(0, 0, obj.scale, tmpContext);
                    tmpContext.fillStyle = "#c3c28b";
                    var chips = 4;
                    var rotVal = mathPI2 / chips;
                    var tmpRange;
                    for (var i = 0; i < chips; ++i) {
                        tmpRange = UTILS.randInt(obj.scale / 2.5, obj.scale / 1.7);
                        renderCircle(tmpRange * Math.cos(rotVal * i), tmpRange * Math.sin(rotVal * i),
                                     UTILS.randInt(4, 5), tmpContext, true);
                    }
                } else if (obj.name == "wood wall" || obj.name == "stone wall" || obj.name == "castle wall") {
                    tmpContext.fillStyle = (obj.name == "castle wall") ? "#83898e" : (obj.name == "wood wall") ?
                        "#a5974c" : "#939393";
                    var sides = (obj.name == "castle wall") ? 4 : 3;
                    renderStar(tmpContext, sides, obj.scale * 1.1, obj.scale * 1.1);
                    tmpContext.fill();
                    tmpContext.stroke();
                    tmpContext.fillStyle = (obj.name == "castle wall") ? "#9da4aa" : (obj.name == "wood wall") ?
                        "#c9b758" : "#bcbcbc";
                    renderStar(tmpContext, sides, obj.scale * 0.65, obj.scale * 0.65);
                    tmpContext.fill();
                } else if (obj.name == "spikes" || obj.name == "greater spikes" || obj.name == "poison spikes" || obj.name == "spinning spikes") {
                    tmpContext.fillStyle = (obj.name == "poison spikes") ? "#7b935d" : "#939393";

                    var tmpScale = (obj.scale * 0.6);
                    renderStar(tmpContext, (obj.name == "spikes") ? 5 : 6, obj.scale, tmpScale);

                    tmpContext.fill();
                    tmpContext.stroke();

                    obj.prediction && (
                        tmpContext.globalAlpha = 0.6,
                        tmpContext.fillStyle = obj.preplace ? "#00FFFF" : "#00FFFF",
                        renderStar(tmpContext, obj.name == "spikes" ? 5 : 6, obj.scale, tmpScale),
                        tmpContext.fill(),
                        tmpContext.globalAlpha = 1);

                    tmpContext.fillStyle = "#a5974c";
                    renderCircle(0, 0, tmpScale, tmpContext);

                    obj.prediction && (
                        tmpContext.globalAlpha = 0.6,
                        tmpContext.fillStyle = obj.preplace ? "#00FFFF" : "#00FFFF",
                        renderCircle(0, 0, tmpScale, tmpContext),
                        tmpContext.globalAlpha = 1);

                    tmpContext.fillStyle = "#c9b758";
                    renderCircle(0, 0, tmpScale / 2, tmpContext, true);

                    obj.prediction && (
                        tmpContext.globalAlpha = 0.6,
                        tmpContext.fillStyle = obj.preplace ? "#00FFFF" : "#00FFFF",
                        renderCircle(0, 0, tmpScale / 2, tmpContext, !0),
                        tmpContext.globalAlpha = 1);
                } else if (obj.name == "windmill" || obj.name == "faster windmill" || obj.name == "power mill") {
                    tmpContext.fillStyle = "#a5974c";
                    renderCircle(0, 0, obj.scale, tmpContext);

                    obj.prediction && (
                        tmpContext.globalAlpha = 0.6,
                        tmpContext.fillStyle = obj.preplace ? "#00FFFF" : "#00FFFF",
                        renderCircle(0, 0, obj.scale, tmpContext),
                        tmpContext.globalAlpha = 1);

                    tmpContext.fillStyle = "#c9b758";
                    renderRectCircle(0, 0, obj.scale * 1.5, 29, 4, tmpContext);

                    obj.prediction && (
                        tmpContext.globalAlpha = 0.6,
                        tmpContext.fillStyle = obj.preplace ? "#00FFFF" : "#00FFFF",
                        renderRectCircle(0, 0, obj.scale * 1.5, 29, 4, tmpContext),
                        tmpContext.globalAlpha = 1);

                    tmpContext.fillStyle = "#a5974c";
                    renderCircle(0, 0, obj.scale * 0.5, tmpContext);

                    obj.prediction && (
                        tmpContext.globalAlpha = 0.6,
                        tmpContext.fillStyle = obj.preplace ? "#00FFFF" : "#00FFFF",
                        renderHealthCircle(0, 0, obj.scale * 1.0, tmpContext, false, true),
                        tmpContext.globalAlpha = 1);
                } else if (obj.name == "mine") {
                    tmpContext.fillStyle = "#939393";
                    renderStar(tmpContext, 3, obj.scale, obj.scale);
                    tmpContext.fill();
                    tmpContext.stroke();
                    tmpContext.fillStyle = "#bcbcbc";
                    renderStar(tmpContext, 3, obj.scale * 0.55, obj.scale * 0.65);
                    tmpContext.fill();
                } else if (obj.name == "sapling") {
                    for (var i = 0; i < 2; ++i) {
                        var tmpScale = obj.scale * (!i ? 1 : 0.5);
                        renderStar(tmpContext, 7, tmpScale, tmpScale * 0.7);
                        tmpContext.fillStyle = (!i ? "#9ebf57" : "#b4db62");
                        tmpContext.fill();
                        if (!i) tmpContext.stroke();
                    }
                } else if (obj.name == "pit trap") {

                    if (obj.prediction) {
                        // Prediction mode: render as circle
                        tmpContext.fillStyle = obj.preplace ? "#00FFFF" : "#00FFFF";
                        tmpContext.globalAlpha = 0.6;
                        renderHealthCircle(0, 0, obj.scale * 1.0, tmpContext, false, true);
                        tmpContext.fill();
                        tmpContext.globalAlpha = 1;
                    } else {
                        tmpContext.fillStyle = "#a5974c";
                        renderStar(tmpContext, 3, obj.scale * 1.1, obj.scale * 1.1);
                        tmpContext.fill();
                        tmpContext.stroke();
                        tmpContext.fillStyle = outlineColor;
                        renderStar(tmpContext, 3, obj.scale * 0.70, obj.scale * 0.70);
                        tmpContext.fill();
                    }
                } else if (obj.name == "boost pad") {
                    tmpContext.fillStyle = "#7e7f82";
                    renderRect(0, 0, obj.scale * 2, obj.scale * 2, tmpContext);
                    tmpContext.fill();
                    tmpContext.stroke();
                    tmpContext.fillStyle = "#dbd97d";
                    renderTriangle(obj.scale * 1, tmpContext);
                } else if (obj.name == "turret") {
                    tmpContext.fillStyle = "#a5974c";
                    renderCircle(0, 0, obj.scale, tmpContext);
                    tmpContext.fill();
                    tmpContext.stroke();
                    tmpContext.fillStyle = "#939393";
                    var tmpLen = 50;
                    renderRect(0, -tmpLen / 2, obj.scale * 0.9, tmpLen, tmpContext);
                    renderCircle(0, 0, obj.scale * 0.6, tmpContext);
                    tmpContext.fill();
                    tmpContext.stroke();
                } else if (obj.name == "platform") {
                    tmpContext.fillStyle = "#cebd5f";
                    var tmpCount = 4;
                    var tmpS = obj.scale * 2;
                    var tmpW = tmpS / tmpCount;
                    var tmpX = -(obj.scale / 2);
                    for (var i = 0; i < tmpCount; ++i) {
                        renderRect(tmpX - (tmpW / 2), 0, tmpW, obj.scale * 2, tmpContext);
                        tmpContext.fill();
                        tmpContext.stroke();
                        tmpX += tmpS / tmpCount;
                    }
                } else if (obj.name == "healing pad") {
                    tmpContext.fillStyle = "#7e7f82";
                    renderRect(0, 0, obj.scale * 2, obj.scale * 2, tmpContext);
                    tmpContext.fill();
                    tmpContext.stroke();
                    tmpContext.fillStyle = "#db6e6e";
                    renderRectCircle(0, 0, obj.scale * 0.65, 20, 4, tmpContext, true);
                } else if (obj.name == "spawn pad") {
                    tmpContext.fillStyle = "#7e7f82";
                    renderRect(0, 0, obj.scale * 2, obj.scale * 2, tmpContext);
                    tmpContext.fill();
                    tmpContext.stroke();
                    tmpContext.fillStyle = "#71aad6";
                    renderCircle(0, 0, obj.scale * 0.6, tmpContext);
                } else if (obj.name == "blocker") {
                    tmpContext.fillStyle = "#7e7f82";
                    renderCircle(0, 0, obj.scale, tmpContext);
                    tmpContext.fill();
                    tmpContext.stroke();
                    tmpContext.rotate(Math.PI / 4);
                    tmpContext.fillStyle = "#db6e6e";
                    renderRectCircle(0, 0, obj.scale * 0.65, 20, 4, tmpContext, true);
                } else if (obj.name == "teleporter") {
                    tmpContext.fillStyle = "#7e7f82";
                    renderCircle(0, 0, obj.scale, tmpContext);
                    tmpContext.fill();
                    tmpContext.stroke();
                    tmpContext.rotate(Math.PI / 4);
                    tmpContext.fillStyle = "#d76edb";
                    renderCircle(0, 0, obj.scale * 0.5, tmpContext, true);
                }
                tmpSprite = tmpCanvas;
                if (!asIcon)
                    itemSprites[obj.id + (obj.predictEnemyTrap ? 100 : (obj.prediction ? (obj.preplace ? 200 : 300) : 0))] = tmpSprite;
            }
            return tmpSprite;
        }

        // RENDER LEAF:
        function renderLeaf(x, y, l, r, ctxt) {
            var endX = x + (l * Math.cos(r));
            var endY = y + (l * Math.sin(r));
            var width = l * 0.4;
            ctxt.moveTo(x, y);
            ctxt.beginPath();
            ctxt.quadraticCurveTo(((x + endX) / 2) + (width * Math.cos(r + Math.PI / 2)),
                                  ((y + endY) / 2) + (width * Math.sin(r + Math.PI / 2)), endX, endY);
            ctxt.quadraticCurveTo(((x + endX) / 2) - (width * Math.cos(r + Math.PI / 2)),
                                  ((y + endY) / 2) - (width * Math.sin(r + Math.PI / 2)), x, y);
            ctxt.closePath();
            ctxt.fill();
            ctxt.stroke();
        }

        // RENDER CIRCLE:
        function renderCircle(x, y, scale, tmpContext, dontStroke, dontFill) {
            tmpContext = tmpContext || mainContext;
            tmpContext.beginPath();
            tmpContext.arc(x, y, scale, 0, 2 * Math.PI);
            if (!dontFill) tmpContext.fill();
            if (!dontStroke) tmpContext.stroke();
        }

        // RENDER STAR SHAPE:
        function renderStar(ctxt, spikes, outer, inner) {
            var rot = Math.PI / 2 * 3;
            var x, y;
            var step = Math.PI / spikes;
            ctxt.beginPath();
            ctxt.moveTo(0, -outer);
            for (var i = 0; i < spikes; i++) {
                x = Math.cos(rot) * outer;
                y = Math.sin(rot) * outer;
                ctxt.lineTo(x, y);
                rot += step;
                x = Math.cos(rot) * inner;
                y = Math.sin(rot) * inner;
                ctxt.lineTo(x, y);
                rot += step;
            }
            ctxt.lineTo(0, -outer);
            ctxt.closePath();
        }

        // RENDER RECTANGLE:
        function renderRect(x, y, w, h, ctxt, stroke) {
            ctxt.fillRect(x - (w / 2), y - (h / 2), w, h);
            if (!stroke)
                ctxt.strokeRect(x - (w / 2), y - (h / 2), w, h);
        }

        // RENDER RECTCIRCLE:
        function renderRectCircle(x, y, s, sw, seg, ctxt, stroke) {
            ctxt.save();
            ctxt.translate(x, y);
            seg = Math.ceil(seg / 2);
            for (var i = 0; i < seg; i++) {
                renderRect(0, 0, s * 2, sw, ctxt, stroke);
                ctxt.rotate(Math.PI / seg);
            }
            ctxt.restore();
        }

        // RENDER BLOB:
        function renderBlob(ctxt, spikes, outer, inner) {
            var rot = Math.PI / 2 * 3;
            var x, y;
            var step = Math.PI / spikes;
            var tmpOuter;
            ctxt.beginPath();
            ctxt.moveTo(0, -inner);
            for (var i = 0; i < spikes; i++) {
                tmpOuter = UTILS.randInt(outer + 0.9, outer * 1.2);
                ctxt.quadraticCurveTo(Math.cos(rot + step) * tmpOuter, Math.sin(rot + step) * tmpOuter,
                                      Math.cos(rot + (step * 2)) * inner, Math.sin(rot + (step * 2)) * inner);
                rot += step * 2;
            }
            ctxt.lineTo(0, -inner);
            ctxt.closePath();
        }

        // RENDER TRIANGLE:
        function renderTriangle(s, ctx) {
            ctx = ctx || mainContext;
            var h = s * (Math.sqrt(3) / 2);
            ctx.beginPath();
            ctx.moveTo(0, -h / 2);
            ctx.lineTo(-s / 2, h / 2);
            ctx.lineTo(s / 2, h / 2);
            ctx.lineTo(0, -h / 2);
            ctx.fill();
            ctx.closePath();
        }

        // PREPARE MENU BACKGROUND:
        function prepareMenuBackground() {
            var tmpMid = config.mapScale / 2;
            objectManager.add(0, tmpMid, tmpMid + 200, 0, config.treeScales[3], 0);
            objectManager.add(1, tmpMid, tmpMid - 480, 0, config.treeScales[3], 0);
            objectManager.add(2, tmpMid + 300, tmpMid + 450, 0, config.treeScales[3], 0);
            objectManager.add(3, tmpMid - 950, tmpMid - 130, 0, config.treeScales[2], 0);
            objectManager.add(4, tmpMid - 750, tmpMid - 400, 0, config.treeScales[3], 0);
            objectManager.add(5, tmpMid - 700, tmpMid + 400, 0, config.treeScales[2], 0);
            objectManager.add(6, tmpMid + 800, tmpMid - 200, 0, config.treeScales[3], 0);
            objectManager.add(7, tmpMid - 260, tmpMid + 340, 0, config.bushScales[3], 1);
            objectManager.add(8, tmpMid + 760, tmpMid + 310, 0, config.bushScales[3], 1);
            objectManager.add(9, tmpMid - 800, tmpMid + 100, 0, config.bushScales[3], 1);
            objectManager.add(10, tmpMid - 800, tmpMid + 300, 0, items.list[4].scale, items.list[4].id, items.list[10]);
            objectManager.add(11, tmpMid + 650, tmpMid - 390, 0, items.list[4].scale, items.list[4].id, items.list[10]);
            objectManager.add(12, tmpMid - 400, tmpMid - 450, 0, config.rockScales[2], 2);
        }

        // LOAD GAME OBJECT:
        function loadGameObject(data) {
            for (var i = 0; i < data.length;) {
                objectManager.add(data[i], data[i + 1], data[i + 2], data[i + 3], data[i + 4],
                                  data[i + 5], items.list[data[i + 6]], true, (data[i + 7] >= 0 ? { sid: data[i + 7] } : null));

                if (data[i + 7] >= 0) {
                    spawnedObjectSids.push(data[i + 7]);
                }

                i += 8;
            }

            if (!promiseResolve) return;
            promiseResolve(true);
        }

        // WIGGLE GAME OBJECT:
        function wiggleGameObject(dir, sid) {
            tmpObj = findObjectBySid(sid);
            if (tmpObj) {
                damageObjects.push(tmpObj);

                tmpObj.xWiggle += config.gatherWiggle * Math.cos(dir);
                tmpObj.yWiggle += config.gatherWiggle * Math.sin(dir);
            }
        }

        // SHOOT TURRET:
        function shootTurret(sid, dir) {
            tmpObj = findObjectBySid(sid);
            if (tmpObj) {
                tmpObj.dir = dir;
                tmpObj.xWiggle += config.gatherWiggle * Math.cos(dir + Math.PI);
                tmpObj.yWiggle += config.gatherWiggle * Math.sin(dir + Math.PI);
            }
        }

        // ADD PROJECTILE:
        function addProjectile(x, y, dir, range, speed, indx, layer, sid) {
            let projectile = projectileManager.addProjectile(x, y, dir, range, speed, indx, null, null, layer);
            projectile.sid = sid;

            /*
                if(inWindow){
                    projectileManager.addProjectile(x, y, dir, range, speed, indx, null, null, layer).sid = sid;
                }
                */

            shoots.push({ projectile: projectile, x: x, y: y, range: range, speed: speed });
        }

        // REMOVE PROJECTILE:
        function remProjectile(sid, range) {
            for (let projectile of projectiles) {
                if (projectile.sid == sid) {
                    projectile.range = range;

                    removeShoots.push(projectile);
                    if (damageObjects.length > 0) {
                        objectShoots.push({ objects: damageObjects, projectile: projectile });
                        damageObjects = [];
                    }
                }
            }
        }

        // ANIMATE AI:
        function animateAI(sid) {
            tmpObj = findAIBySID(sid);
            if (tmpObj) tmpObj.startAnim();
        }

        // ADD AI:
        function loadAI(data) {
            for (var i = 0; i < ais.length; ++i) {
                ais[i].forcePos = !ais[i].visible;
                ais[i].visible = false;
            }
            if (data) {
                var tmpTime = Date.now();
                for (var i = 0; i < data.length;) {
                    tmpObj = findAIBySID(data[i]);
                    if (tmpObj) {
                        tmpObj.index = data[i + 1];
                        tmpObj.t1 = (tmpObj.t2 === undefined) ? tmpTime : tmpObj.t2;
                        tmpObj.t2 = tmpTime;
                        tmpObj.x1 = tmpObj.x;
                        tmpObj.y1 = tmpObj.y;
                        tmpObj.x2 = data[i + 2];
                        tmpObj.y2 = data[i + 3];
                        tmpObj.d1 = (tmpObj.d2 === undefined) ? data[i + 4] : tmpObj.d2;
                        tmpObj.d2 = data[i + 4];
                        tmpObj.health = data[i + 5];
                        tmpObj.dt = 0;
                        tmpObj.visible = true;
                    } else {
                        tmpObj = aiManager.spawn(data[i + 2], data[i + 3], data[i + 4], data[i + 1]);
                        tmpObj.x2 = tmpObj.x;
                        tmpObj.y2 = tmpObj.y;
                        tmpObj.d2 = tmpObj.dir;
                        tmpObj.health = data[i + 5];
                        if (!aiManager.aiTypes[data[i + 1]].name)
                            tmpObj.name = config.cowNames[data[i + 6]];
                        tmpObj.forcePos = true;
                        tmpObj.sid = data[i];
                        tmpObj.visible = true;
                    }
                    i += 7;
                }
            }
        }

        // RENDER AI:
        var aiSprites = {};
        function renderAI(obj, ctxt) {
            var tmpIndx = obj.index;
            var tmpSprite = aiSprites[tmpIndx];
            if (!tmpSprite) {
                var tmpImg = new Image();
                tmpImg.onload = function () {
                    this.isLoaded = true;
                    this.onload = null;
                };
                tmpImg.src = ".././img/animals/" + obj.src + ".png";
                tmpSprite = tmpImg;
                aiSprites[tmpIndx] = tmpSprite;
            }
            if (tmpSprite.isLoaded) {
                var tmpScale = obj.scale * 1.2 * (obj.spriteMlt || 1);
                ctxt.drawImage(tmpSprite, -tmpScale, -tmpScale, tmpScale * 2, tmpScale * 2);
            }
        }

        // OBJECT ON SCREEN:
        function isOnScreen(x, y, s) {
            return (x + s >= 0 && x - s <= maxScreenWidth && y + s >= 0 && y - s <= maxScreenHeight)
        }

        // ADD NEW PLAYER:
        function getEl(id) {
            return document.getElementById(id);
        }

        function addPlayer(data, isYou) {
            var tmpPlayer = findPlayerByID(data[0]);
            if (!tmpPlayer) {
                tmpPlayer = new Player(data[0], data[1], config, UTILS, projectileManager,
                                       objectManager, players, ais, items, hats, accessories);
                players.push(tmpPlayer);
            }

            tmpPlayer.spawn(isYou ? moofoll : null);
            tmpPlayer.visible = false;
            tmpPlayer.y2 = undefined;
            tmpPlayer.setData(data);
            tmpPlayer.shameAbuse = false;

            primaryReload[tmpPlayer.sid] = 1;
            secondaryReload[tmpPlayer.sid] = 1;
            turretReload[tmpPlayer.sid] = 1;



            if (isYou) {
                ePress = false;
                autogathering = false;
                keyCodeWeapon = 0;

                myPlayer = tmpPlayer;
                window._myPlayer = myPlayer;
                camX = myPlayer.x;
                camY = myPlayer.y;
                updateItems();
                updateStatusDisplay();
                updateAge();
                updateItemCountDisplay();
                updateUpgrades(0);
                gameUI.style.display = "block";
            }
        }

        // REMOVE PLAYER:
        function removePlayer(id) {
            for (var i = 0; i < players.length; i++) {
                if (players[i].id == id) {
                    players.splice(i, 1);
                    break;
                }
            }
        }

        // UPDATE PLAYER ITEM VALUES:
        function updateItemCounts(index, value) {
            if (myPlayer) {
                myPlayer.itemCounts[index] = value;
                updateItemCountDisplay(index);
            }
        }

        // UPDATE PLAYER VALUE:
        function updatePlayerValue(index, value, updateView) {
            if (myPlayer) {
                myPlayer[index] = value;
                if (updateView)
                    updateStatusDisplay();
            }
        }

        let autoMills = false;
        let autoVelocityTickToggled = false;
        // Set on the tick the turret goes out, spent on the next one.
        let velocityTarget = null;
        let autoBreak = false;
        let autoBreakAngle;
        let breakObject;
        let nearestTrap;

        let enemiesNear;
        let nearestEnemy;

        let ePress = false;
        let rightClick = false;
        let leftClick = false;
        let checkGather = false;
        let lastGatherState = false;

        let damageTick = 0;
        let tick = 0;

        let hits = [];
        let shoots = [];
        let removeShoots = [];

        let primaryReload = [];
        let secondaryReload = [];
        let turretReload = [];

        let placeTick = 0;
        let predictObjects = [];
        let prePlaceObjects = [];
        let near = [];
        let predictEnemyTraps = [];

        let predictWeapon = 0;
        let keyCodeWeapon = 0;

        let healing = false;

        let autoReload = false;

        let deathDamages = [];

        let spikeDmg = 0;
        let spikeDmgCount = 0;
        let spikeDamages = [];

        let damageObjects = [];
        let objectHits = [];
        let objectShoots = [];

        let antiReverse = [];
        let antiInsta = [];

        let damageByPoisonTick = 0;
        let damagesByTurrets = [];
        let damagesByHits = [];
        let damagesByShoots = [];
        let damages = [];

        let qPress = false;
        let spikePress = false;
        let trapPress = false;
        let turretPress = false;

        let spikeKnockPosLine = {};

        let visibleObjects = [];
        let spikes_enemy = [];
        let trap_where_im_in = null;
        let cactuses = [];

        let enemySpikes;
        let antiVelocitySpikeSync;

        let trapBreaked = false;
        let trapBreakedTick = 0;

        let soldierAnti = false;

        let predictMoveAngle = null;
        let lastMoveAngle = null;


        let nearestEnemiesCount = 0;

        let antiTick = false;
        let antiTickTimeout;

        let predictDamage = {
            spike: 0,
            poison: 0,
            player: 0,
        };

        let antiPush = false;

        let autoPush = false;
        let autoPushAngle = null;
        let pushPositions;

        let predictMove = [];
        let moveVectors = {
            87: [0, -1],
            83: [0, 1],
            65: [-1, 0],
            68: [1, 0],
        };

        let autoaim = false;

        let instaKill = [];
        let insta = {
            primary: false,
            secondary: false
        }

        let spamPrePlacer = false;
        let prePlaceInterval;

        // BULLTICKS
        function canVelocitySpikeTick() {
            if (!nearestEnemy) return;

            let trap = traps_our.filter(trap => UTILS.getDistance(nearestEnemy.x2, nearestEnemy.y2, trap.x, trap.y) < trap.scale)[0];
            let isEnemyInSpike = false;

            // simulate pos if we would kb enemy
            let posX = nearestEnemy.x2 + 111 * (.3 + getPlayerInfo(myPlayer, "primaryKnockback")) * Math.cos(Math.atan2(nearestEnemy.y2 - myPlayer.y2, nearestEnemy.x2 - myPlayer.x2));
            let posY = nearestEnemy.y2 + 111 * (.3 + getPlayerInfo(myPlayer, "primaryKnockback")) * Math.sin(Math.atan2(nearestEnemy.y2 - myPlayer.y2, nearestEnemy.x2 - myPlayer.x2));
            enemy_collidingspike = false;
            for (let object of spikes_our) {
                if (trap) {
                    if (nearestEnemy.spikeDamage > 0) {
                        enemy_collidingspike = true;
                        break;
                    }
                }
                else {
                    if (UTILS.lineInRect(
                        object.x - (nearestEnemy.scale + object.scale),
                        object.y - (nearestEnemy.scale + object.scale),
                        object.x + (nearestEnemy.scale + object.scale),
                        object.y + (nearestEnemy.scale + object.scale),
                        nearestEnemy.x2, nearestEnemy.y2, nearestEnemy.xVel, nearestEnemy.yVel)) {
                        isEnemyInSpike = true;
                        break;
                    }

                    if (UTILS.lineInRect(
                        object.x - (nearestEnemy.scale + object.scale),
                        object.y - (nearestEnemy.scale + object.scale),
                        object.x + (nearestEnemy.scale + object.scale),
                        object.y + (nearestEnemy.scale + object.scale),
                        nearestEnemy.x2, nearestEnemy.y2,
                        posX, posY)) {
                        isEnemyInSpike = true;
                        break;
                    }
                }
            }

            if (enemy_collidingspike) {
                if (getPlayerInfo(nearestEnemy, "secondaryWeapon") == "hammer") {
                    if (nearestEnemy.shameCount > 5) {
                        isEnemyInSpike = true;
                    }
                    if (enemy_lastcollidngspike && secondaryReload[nearestEnemy.sid] == 1) {
                        isEnemyInSpike = true;
                    }
                    else {
                        if (secondaryReload[nearestEnemy.sid] == 1 && nearestEnemy.lastSecondaryReload < 1) {
                            isEnemyInSpike = true;
                        }
                    }
                }
                else {
                    isEnemyInSpike = true;
                }
            }

            enemy_lastcollidngspike = enemy_collidingspike;

            if (isEnemyInSpike) {
                return (myPlayer.weapons[0] == 4 || myPlayer.weapons[0] == 5) && UTILS.getDistance(nearestEnemy.xVel, nearestEnemy.yVel, myPlayer.xVel, myPlayer.yVel) <= (35 * 1.8 + items.weapons[myPlayer.weapons[0]].range)
                && primaryReload[myPlayer.sid] == 1 && !autoaim;
            }
        }

        function doSmartTickAnti() {
            if (!nearestEnemy) return false;
            if (getPlayerInfo(myPlayer, "secondaryWeapon") != "hammer") return false;
            if (!window.vars.antiSmart) return false;

            const enemyTrapped = traps_our.find(trap =>
                                                UTILS.getDistance(trap.x, trap.y, nearestEnemy.x2, nearestEnemy.y2) < trap.scale
                                               );

            if (enemyTrapped) return false;

            if (!imTrapped) return false;

            if (spikeDamages.length > 0) return false;

            const objects = visibleObjects.filter(obj => trap_where_im_in.health <= getPlayerInfo(myPlayer, "secondaryStructureDmg") && obj != trap_where_im_in);


            let shouldWait = false;
            for (let i = 0; i < 36; i++) {
                let angle = UTILS.toRad(i * (360 / 36));
                let id = 9;

                let config = {
                    x: nearestEnemy.x2 + (35 + items.list[id].scale + (items.list[id].placeOffset || 0)) * Math.cos(angle),
                    y: nearestEnemy.y2 + (35 + items.list[id].scale + (items.list[id].placeOffset || 0)) * Math.sin(angle),
                    scale: items.list[id].scale
                };

                if (objectManager.checkItemLocation(config.x, config.y, config.scale, 0.6, id, false, nearestEnemy, objects)) {
                    if (UTILS.getDistance(myPlayer.x2, myPlayer.y2, config.x, config.y) < 35 + config.scale) {
                        const knockbackAngle = Math.atan2(myPlayer.y2 - config.y, myPlayer.x2 - config.x);
                        const projectedX = myPlayer.x2 + 111 * Math.cos(knockbackAngle);
                        const projectedY = myPlayer.y2 + 111 * Math.sin(knockbackAngle);
                        for (let spike of spikes_enemy) {
                            if (UTILS.lineInRect(
                                spike.x - spike.scale, spike.y - spike.scale,
                                spike.x + spike.scale, spike.y + spike.scale,
                                myPlayer.x2, myPlayer.y2,
                                projectedX, projectedY
                            )) {
                                shouldWait = true;
                                break;
                            }
                        }
                    }
                }

                if (shouldWait) break;
            }

            if (shouldWait && trap_where_im_in.health <= getPlayerInfo(myPlayer, "secondaryStructureDmg")) {
                autoBreak = false;
                if (secondaryReload[myPlayer.sid] < 1)
                    predictWeapon = myPlayer.weapons[1];
                else if (primaryReload[myPlayer.sid] < 1)
                    predictWeapon = myPlayer.weapons[0];
                else {
                    return true;
                }
            }
            return false;
        }

        function canSmartTick() {
            if (!nearestEnemy) return false;
            if (autoPush) return false;
            if (getPlayerInfo(myPlayer, "secondaryWeapon") != "hammer") return false;
            if (secondaryReload[myPlayer.sid] < 1) return false;
            if (nearestEnemy.spikeDamage > 0) return false;


            let closestSpikeToKb = null;

            // get all oneshottable objects and in range of my hammer range
            let candidateObjects = visibleObjects.filter(object => object.health <= getPlayerInfo(myPlayer, "secondaryStructureDmg")
                                                         && UTILS.getDistance(object.x, object.y, myPlayer.x2, myPlayer.y2) <= object.scale + getPlayerInfo(myPlayer, "secondaryRange")
                                                         && UTILS.getDistance(object.x, object.y, nearestEnemy.x2, nearestEnemy.y2) < object.scale * 2
                                                         && !(object.id > 5 && object.id < 10));

            smartTickObject = null;
            for (let object of candidateObjects) {
                let prePlaceObjects = visibleObjects.filter(obj => obj !== object);
                const spikeAngles = getPrePlaceAngles(myPlayer.items[2], prePlaceObjects);
                const placeableSpikeAngles = spikeAngles.filter(obj => obj.placeable);
                closestSpikeToKb = (() => {
                    const validAngles = placeableSpikeAngles
                    .filter(a => {
                        const canHitEnemy = UTILS.lineInRect(
                            a.x - (nearestEnemy.scale + a.scale - 3),
                            a.y - (nearestEnemy.scale + a.scale - 3),
                            a.x + (nearestEnemy.scale + a.scale - 3),
                            a.y + (nearestEnemy.scale + a.scale - 3),
                            nearestEnemy.x2, nearestEnemy.y2,
                            nearestEnemy.xVel, nearestEnemy.yVel
                        );

                        if (!canHitEnemy) return false;

                        // Check if knockback will push enemy into our spikes
                        const knockbackAngle = Math.atan2(nearestEnemy.yVel - a.y, nearestEnemy.xVel - a.x);
                        const projectedX = nearestEnemy.xVel + 200 * Math.cos(knockbackAngle);
                        const projectedY = nearestEnemy.yVel + 200 * Math.sin(knockbackAngle);

                        for (let spike of spikes_our) {
                            if (UTILS.lineInRect(
                                spike.x - spike.scale, spike.y - spike.scale,
                                spike.x + spike.scale, spike.y + spike.scale,
                                nearestEnemy.xVel, nearestEnemy.yVel,
                                projectedX, projectedY
                            )) {
                                return true;
                            }
                        }
                        return false;
                    })
                    .map(a => {
                        // Calculate alignment score
                        const knockbackAngle = Math.atan2(nearestEnemy.yVel - a.y, nearestEnemy.xVel - a.x);
                        const projectedX = nearestEnemy.xVel + 200 * Math.cos(knockbackAngle);
                        const projectedY = nearestEnemy.yVel + 200 * Math.sin(knockbackAngle);

                        let bestAlignment = Infinity;

                        for (let spike of spikes_our) {
                            if (UTILS.lineInRect(
                                spike.x - spike.scale, spike.y - spike.scale,
                                spike.x + spike.scale, spike.y + spike.scale,
                                nearestEnemy.xVel, nearestEnemy.yVel,
                                projectedX, projectedY
                            )) {
                                const angleToEnemy = Math.atan2(nearestEnemy.yVel - a.y, nearestEnemy.xVel - a.x);
                                const enemyToSpike = Math.atan2(spike.y - nearestEnemy.yVel, spike.x - nearestEnemy.xVel);

                                let angleDiff = Math.abs(angleToEnemy - enemyToSpike);
                                if (angleDiff > Math.PI) angleDiff = 2 * Math.PI - angleDiff;

                                bestAlignment = Math.min(bestAlignment, angleDiff);
                            }
                        }

                        return { angle: a, alignment: bestAlignment };
                    });

                    if (validAngles.length === 0) return undefined;

                    // Find the best alignment score
                    const bestAlignmentScore = Math.min(...validAngles.map(v => v.alignment));

                    // Filter to only angles with the best alignment, then pick closest to enemy
                    return validAngles
                        .filter(v => v.alignment === bestAlignmentScore)
                        .sort((a, b) =>
                              UTILS.getDistance(nearestEnemy.xVel, nearestEnemy.yVel, a.angle.x, a.angle.y) -
                              UTILS.getDistance(nearestEnemy.xVel, nearestEnemy.yVel, b.angle.x, b.angle.y)
                             )[0]?.angle;
                })();

                if (closestSpikeToKb) {
                    smartTickObject = object;
                    break;
                }
            }

            if (smartTickObject) return true;

            return false;
        }

        function advancedShameCombat() {
            if (!nearestEnemy) return false;
            if (getPlayerInfo(myPlayer, "secondaryWeapon") != "hammer") return false;
            if (nearestEnemy.spikeDamage > 0) return false;
            if (nearestEnemy.shameCount > 6) return false;
            if(!imTrapped) return false;
            if(myPlayer.spikeDamage > 0 ) return false;
            if (!window.vars.shameGrind) return false;
            const enemyTrapped = traps_our.find(trap =>
                                                UTILS.getDistance(trap.x, trap.y, nearestEnemy.x2, nearestEnemy.y2) < trap.scale
                                               );
            if (!enemyTrapped) return false;
            if (UTILS.getDistance(enemyTrapped.x, enemyTrapped.y, myPlayer.x2, myPlayer.y2) > 50 + 75) return false;
            if (UTILS.getDistance(myPlayer.x2, myPlayer.y2, nearestEnemy.x2, nearestEnemy.y2) > (35 * 1.8 + 75)) return false;
            let objects = visibleObjects.filter(object => object != enemyTrapped);

            let placableSpikes = getPrePlaceAngles(myPlayer.items[2], objects);

            let placableTraps = getPrePlaceAngles(myPlayer.items[4], objects);

            let traps = placableTraps.filter(obj => obj.placeable && UTILS.getDistance(obj.x, obj.y, nearestEnemy.x2, nearestEnemy.y2) < 50)

            let spikes = placableSpikes.filter(obj => obj.placeable && UTILS.getDistance(obj.x, obj.y, nearestEnemy.x2, nearestEnemy.y2) < 35 + 52)

            if (traps.length > 0 && spikes.length > 0) return true;

            return false;



        }

        function canShamePlace() {
            if (!nearestEnemy) return false;
            if (getPlayerInfo(myPlayer, "secondaryWeapon") != "hammer") return false;
            if (nearestEnemy.spikeDamage > 0) return false;
            if (nearestEnemy.shameCount > 6) return false;
            if (!window.vars.shameGrind) return false;

            const enemyTrapped = traps_our.find(trap =>
                                                UTILS.getDistance(trap.x, trap.y, nearestEnemy.x2, nearestEnemy.y2) < trap.scale
                                               );

            if (!enemyTrapped) return false;

            if (enemyTrapped.health > getPlayerInfo(myPlayer, "secondaryStructureDmg")) return false;
            if (UTILS.getDistance(enemyTrapped.x, enemyTrapped.y, myPlayer.x2, myPlayer.y2) > 50 + 75) return false;
            if (UTILS.getDistance(myPlayer.x2, myPlayer.y2, nearestEnemy.x2, nearestEnemy.y2) > (35 * 1.8 + 75)) return false;

            let objects = visibleObjects.filter(object => object != enemyTrapped);

            let placableSpikes = getPrePlaceAngles(myPlayer.items[2], objects);

            let placableTraps = getPrePlaceAngles(myPlayer.items[4], objects);

            let traps = placableTraps.filter(obj => obj.placeable && UTILS.getDistance(obj.x, obj.y, nearestEnemy.x2, nearestEnemy.y2) < 50)

            let spikes = placableSpikes.filter(obj => obj.placeable && UTILS.getDistance(obj.x, obj.y, nearestEnemy.x2, nearestEnemy.y2) < 35 + 52)

            if (traps.length > 0 && spikes.length > 0) return true;

            return false;


        }


        function canShamePlus() {
            if (!nearestEnemy) return false;
            if (getPlayerInfo(myPlayer, "secondaryWeapon") != "hammer") return false;
            if (secondaryReload[myPlayer.sid] < 1) return false;
            if (primaryReload[myPlayer.sid] < 1) return false;
            if (nearestEnemy.spikeDamage > 0) return false;
            if (nearestEnemy.shameCount > 6) return false;
            if (!window.vars.shameGrind) return false;

            const enemyTrapped = traps_our.find(trap =>
                                                UTILS.getDistance(trap.x, trap.y, nearestEnemy.x2, nearestEnemy.y2) < trap.scale
                                               );

            if (!enemyTrapped) return false;

            if (enemyTrapped.health > getPlayerInfo(myPlayer, "secondaryStructureDmg")) return false;
            if (UTILS.getDistance(enemyTrapped.x, enemyTrapped.y, myPlayer.x2, myPlayer.y2) > 50 + 75) return false;
            if (UTILS.getDistance(myPlayer.x2, myPlayer.y2, nearestEnemy.x2, nearestEnemy.y2) > (35 * 1.8 + 75)) return false;

            let objects = visibleObjects.filter(object => object != enemyTrapped);

            let placableSpikes = getPrePlaceAngles(myPlayer.items[2], objects);

            let placableTraps = getPrePlaceAngles(myPlayer.items[4], objects);

            let traps = placableTraps.filter(obj => obj.placeable && UTILS.getDistance(obj.x, obj.y, nearestEnemy.x2, nearestEnemy.y2) < 50)

            let spikes = placableSpikes.filter(obj => obj.placeable && UTILS.getDistance(obj.x, obj.y, nearestEnemy.x2, nearestEnemy.y2) < 35 + 52)

            if (traps.length > 0 && spikes.length > 0) return true;

            return false;


        }
        function showSettingText(life, setting) {

            const x = myPlayer.x + (Math.random() * 10 - 5);
            const y = myPlayer.y - 14;

            const startScale = myPlayer.scale * 0.9; // smaller text

            const speed = 0.24;

            const color = "#ff7a00";
            const outline = "#000000";

            const o = 2;

            textManager.showText(x - o, y, startScale, speed, life, setting, outline);
            textManager.showText(x + o, y, startScale, speed, life, setting, outline);
            textManager.showText(x, y - o, startScale, speed, life, setting, outline);
            textManager.showText(x, y + o, startScale, speed, life, setting, outline);

            textManager.showText(x, y, startScale, speed, life, setting, color);
        }


        function canAutoShame() {
            if (!window.vars.autoShame) return false;
            if (!nearestEnemy) return false;
            if (nearestEnemy.shameCount >= window.vars.autoShameLimit) return false;

            // Strict Safety Checks
            if (imTrapped) return false;

            // Enemy Safety Check
            const enemyTrapped = traps_our.find(trap =>
                                                UTILS.getDistance(trap.x, trap.y, nearestEnemy.x2, nearestEnemy.y2) < trap.scale
                                               );
            if (enemyTrapped) return false;

            // Smart Spam Logic
            if (!nearestEnemy.shameAbuse) {
                if (nearestEnemy.hitTime && Date.now() - nearestEnemy.hitTime < 600) {
                    return false;
                }
            }

            if (primaryReload[myPlayer.sid] != 1) return false;

            let dist = UTILS.getDistance(myPlayer.x2, myPlayer.y2, nearestEnemy.x2, nearestEnemy.y2);
            let range = 35 * 1.8 + items.weapons[myPlayer.weapons[0]].range;

            if (dist <= range) return true;

            return false;
        }


        function canTrapTick() {
            if (!nearestEnemy) return false;
            if (getPlayerInfo(myPlayer, "secondaryWeapon") != "hammer") return false;
            if (secondaryReload[myPlayer.sid] < 1) return false;
            if (primaryReload[myPlayer.sid] < 1) return false;
            if (nearestEnemy.spikeDamage > 0) return false;
            if (nearestEnemy.shameCount < window.vars.autoShameLimit) return false;
            if (!window.vars.shameTick) return false;



            const enemyTrapped = traps_our.find(trap =>
                                                UTILS.getDistance(trap.x, trap.y, nearestEnemy.x2, nearestEnemy.y2) < trap.scale
                                               );

            if (!enemyTrapped) return false;



            let objects = visibleObjects.filter(object => object != enemyTrapped);

            let placableSpikes = getPrePlaceAngles(myPlayer.items[2], objects);

            if (placableSpikes.length == 0) return false;

            for (let spike of placableSpikes) {
                if (spike.placeable && enemyTrapped.health <= getPlayerInfo(myPlayer, "secondaryStructureDmg")
                    && UTILS.getDistance(enemyTrapped.x, enemyTrapped.y, myPlayer.x2, myPlayer.y2) < spike.scale + 75 &&
                    UTILS.getDistance(spike.x, spike.y, nearestEnemy.x2, nearestEnemy.y2) < spike.scale + 35) {
                    showSettingText(900, "Spike Tick")
                    return true;
                    ;
                }
            }

            return false;


        }

        function canTrapTick2() {
            if (!nearestEnemy) return false;
            if (getPlayerInfo(myPlayer, "secondaryWeapon") != "hammer") return false;
            if (secondaryReload[myPlayer.sid] < 1) return false;
            if (primaryReload[myPlayer.sid] < 1) return false;
            if (nearestEnemy.spikeDamage > 0) return false;
            if (nearestEnemy.shameCount < window.vars.autoShameLimit) return false;
            if (!window.vars.shameTick2) return false;

            const enemyTrapped = traps_our.find(trap =>
                                                UTILS.getDistance(trap.x, trap.y, nearestEnemy.x2, nearestEnemy.y2) < trap.scale
                                               );

            if (!enemyTrapped) return false;

            let objects = visibleObjects.filter(object => object != enemyTrapped);

            let placableSpikes = getPrePlaceAngles(myPlayer.items[2], objects);

            if (placableSpikes.length == 0) return false;

            for (let spike of placableSpikes) {
                if (spike.placeable && enemyTrapped.health <= getPlayerInfo(myPlayer, "secondaryStructureDmg")
                    && UTILS.getDistance(enemyTrapped.x, enemyTrapped.y, myPlayer.x2, myPlayer.y2) < spike.scale + 75 &&
                    UTILS.getDistance(spike.x, spike.y, nearestEnemy.x2, nearestEnemy.y2) < spike.scale + 35) {
                    showSettingText(900, "Spike Tick 2")
                    return true;
                }
            }

            return false;
        }

        function place(id, angle = Math.atan2(mouseY - (screenHeight / 2), mouseX - (screenWidth / 2))) {
            selectToBuild(id);
            sendAtck(1, angle);
            sendAtck(0, angle);
            selectWeapon(predictWeapon);
        }

        function heal(value) {
            for (let i = 0; i < value; i += items.list[myPlayer.items[0]].heal) {
                place(myPlayer.items[0], null);
            }
        }

        function isBoughtHat(id, type) {
            if (type) {
                return myPlayer.tails[id];
            } else {
                return myPlayer.skins[id];
            }
        }

        function hat(id) {
            if (myPlayer.skinIndex != id) {
                if (id == 0) {
                    storeEquip(id, 0);
                } else {
                    if (isBoughtHat(id, 0)) {
                        storeEquip(id, 0);
                    }
                }
            }
        }

        function acc(id) {
            if (myPlayer.tailIndex != id) {
                if (id == 0) {
                    storeEquip(id, 1);
                } else {
                    if (isBoughtHat(id, 1)) {
                        storeEquip(id, 1);
                    }
                }
            }
        }

        function getConfig(id, angle, velocity) {
            return {
                x: (velocity ? myPlayer.xVel : myPlayer.x2) + (35 + items.list[id].scale + (items.list[id].placeOffset || 0)) * Math.cos(angle),
                y: (velocity ? myPlayer.yVel : myPlayer.y2) + (35 + items.list[id].scale + (items.list[id].placeOffset || 0)) * Math.sin(angle),
                scale: items.list[id].scale,
            }
        }

        function canPlace(id, angle, objects, velocity) {
            if (isItemLimit(id)) return false;

            let config = getConfig(id, angle, velocity);
            if (objectManager.checkItemLocation(config.x, config.y, config.scale, 0.6, id, false, myPlayer, objects ? objects : visibleObjects)) return true;

            return false;
        }

        function getPredictWeapon() {
            if (autoBreak) {
                return autoBreakWeapon;
            }
            else {
                if (secondaryReload[myPlayer.sid] < 1) {
                    return myPlayer.weapons[1];
                } else {
                    if (primaryReload[myPlayer.sid] < 1) {
                        return myPlayer.weapons[0];
                    }
                }
            }

            if (rightClick)
                return myPlayer.weapons[1]
            if (leftClick)
                return myPlayer.weapons[0]

            if (getPlayerInfo(myPlayer, "primaryWeapon") == "daggers")
                return myPlayer.weapons[0];
            else if (getPlayerInfo(myPlayer, "secondaryWeapon") == "hammer")
                return myPlayer.weapons[1];
            return myPlayer.weapons[0];
        }

        function addPredictObject(id, angle, preplace) {
            let config = getConfig(id, angle);
            for (let object of predictObjects) {
                if (object.id != 17 && UTILS.getDistance(config.x, config.y, object.x, object.y) < (config.scale + object.scale)) return;
            }

            predictObjects.push({ id: id, angle: angle, name: items.list[id].name, x: config.x, y: config.y, scale: config.scale, preplace: preplace });
        }

        function isItemLimit(id) {
            let group = items.list[id].group;
            let limit = (group.sandboxLimit || 99);

            if (myPlayer.itemCounts[group.id] >= limit) {
                return true;
            }
        }

        function lineInCircle(x, y, x2, y2, circleX, circleY, scale) {
            let lineVec = { x: x2 - x, y: y2 - y };
            let lineToCircleVec = { x: circleX - x, y: circleY - y };

            let projection = (lineToCircleVec.x * lineVec.x + lineToCircleVec.y * lineVec.y) / (lineVec.x * lineVec.x + lineVec.y * lineVec.y);
            let closestPoint = { x: x + projection * lineVec.x, y: y + projection * lineVec.y };

            if (closestPoint.x >= Math.min(x, x2) && closestPoint.x <= Math.max(x, x2) &&
                closestPoint.y >= Math.min(y, y2) && closestPoint.y <= Math.max(y, y2)) {
                return UTILS.getDistance(closestPoint.x, closestPoint.y, circleX, circleY) < scale;
            }

            return false; // Add this - if closest point is outside the line segment
        }

        function isAlly(sid) {
            if (myPlayer.team) {
                for (var i = 0; i < alliancePlayers.length; i += 2) {
                    if (alliancePlayers[i] == sid) {
                        return true;
                    }
                }
            }
        }




        function isObjectOur(object) {
            const sid = object?.owner?.sid;
            // Check if sid exists and matches either your ID or an ally's ID
            return sid !== undefined && (sid === myPlayer.sid || isAlly(sid));
        }

        function isObjectMine(object) {
            // Safely check if the object owner matches your ID
            return object?.owner?.sid === myPlayer.sid;
        }

        let lastPrePlaceObject = null;
        let removedObjects = [];

        // ==================== REPLACE ====================
        //
        // RYN answers a destroyed structure on the packet that reported it: the
        // ground a wall or trap was standing on is the one piece of ground that
        // just became both free and worth having, and the tick it opens is the
        // only tick you are guaranteed to be the first to it.
        //
        // Deltek cannot copy that shape, because it throws the answer away
        // first. killObject pushes the sid and then disableBySid splices the
        // object straight out of gameObjects, so by the time any tick code
        // runs there is no position, no type and no owner left to act on —
        // removedObjects is a list of numbers. So the record is taken at the
        // kill site, where the object still exists, and spent here.
        //
        // Everything below is deltek's own machinery: getConfig for where a
        // placement lands, canPlace for whether it is legal, place() for the
        // send, and the same packet ceiling the auto placer works under.

        let vacatedObjects = [];

        // Called from killObject, before the object is spliced away. Cheap on
        // purpose: this runs inside a packet handler, so it copies six fields
        // and asks one question, and asks nothing at all while the feature is
        // off.
        function noteVacated(object) {
            if (!window.vars.replace) return;
            if (!object || !myPlayer) return;
            if (!isObjectMine(object)) return;

            // A structure only. Food and the like never occupy ground.
            const item = items.list[object.id];
            if (!item || !item.group || !item.group.place) return;

            vacatedObjects.push({
                sid: object.sid,
                id: object.id,
                x: object.x,
                y: object.y,
                scale: object.scale,
                groupId: item.group.id,
                tick: tick
            });
        }

        // Which item in my hotbar rebuilds this kind of ground. Like for like:
        // a trap that was pinning someone is replaced by a trap, not by
        // whatever happens to be cheapest.
        function itemForGroup(groupId) {
            for (let slot = 0; slot < myPlayer.items.length; slot++) {
                const id = myPlayer.items[slot];
                const item = items.list[id];
                if (item && item.group && item.group.id === groupId) return id;
            }
            return null;
        }

        // deltek places on a fixed ring: getConfig puts the object at
        // 35 + scale + placeOffset from the player, so a freed spot is only
        // reachable if it happens to sit on that ring. This is the same
        // arithmetic, asked backwards.
        function placeRadius(id) {
            const item = items.list[id];
            return 35 + item.scale + (item.placeOffset || 0);
        }

        // The angle that lands a placement of `id` closest to (x, y), and
        // whether it lands close enough to count as the same ground.
        function angleOntoGround(id, x, y) {
            const dx = x - myPlayer.x2;
            const dy = y - myPlayer.y2;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist === 0) return null;

            const angle = Math.atan2(dy, dx);
            // One scale of slack: the ring will not pass exactly through the
            // freed centre, and a placement that overlaps the old footprint is
            // still holding the same ground.
            const slack = items.list[id].scale + 10;
            return {
                angle: angle,
                onGround: Math.abs(dist - placeRadius(id)) <= slack
            };
        }

        function replaceVacated() {
            if (!window.vars.replace || !vacatedObjects.length) {
                vacatedObjects.length = 0;
                return;
            }
            if (!myPlayer || !myPlayer.alive) {
                vacatedObjects.length = 0;
                return;
            }

            // The dead object can still be sitting in visibleObjects, which is
            // only rebuilt once a tick — so every legality question below is
            // asked with it taken out, the way RYN re-senses without it.
            let objects = null;

            for (const rec of vacatedObjects) {
                if (window.packets + 5 > 119) break;

                // Same 300 the preplacer works to. Ground further out than
                // that is not ground I am fighting over.
                const dx = rec.x - myPlayer.x2;
                const dy = rec.y - myPlayer.y2;
                if (dx * dx + dy * dy > 300 * 300) continue;

                if (objects === null) {
                    objects = visibleObjects.filter(o => o.sid !== rec.sid);
                }

                // ── what to put back ────────────────────────────────────────
                // Priority 1: an enemy standing on the ground the moment it
                // opened is the reason it opened. Deny it with a spike rather
                // than rebuilding what they just broke.
                let id = null;
                if (nearestEnemy &&
                    (nearestEnemy.x2 - rec.x) ** 2 + (nearestEnemy.y2 - rec.y) ** 2 <
                    (nearestEnemy.scale + rec.scale) ** 2) {
                    id = myPlayer.items[2];
                }

                // Priority 2: like for like.
                if (id === null) id = itemForGroup(rec.groupId);

                // Priority 3: nothing of that kind in hand — a spike holds the
                // ground as well as anything.
                if (id === null) id = myPlayer.items[2];
                if (id === null || id === undefined) continue;
                if (isItemLimit(id)) continue;

                // ── where ───────────────────────────────────────────────────
                const aim = angleOntoGround(id, rec.x, rec.y);
                if (!aim) continue;

                let angle = null;

                // Priority 1: the freed ground itself, when the ring reaches it.
                if (aim.onGround && canPlace(id, aim.angle, objects)) {
                    angle = aim.angle;
                } else {
                    // Priority 2: the ring does not pass through it, or
                    // something else already does. Take the placeable angle
                    // nearest the freed ground — still the right direction,
                    // still this tick.
                    let best = Infinity;
                    for (let i = 0; i < 72; i++) {
                        const test = UTILS.toRad(i * (360 / 72));
                        let diff = Math.abs(test - aim.angle);
                        if (diff > Math.PI) diff = Math.PI * 2 - diff;
                        // An angle either side of the freed one is the same
                        // distance from it, and the two differ only in the last
                        // bits after toRad. The epsilon makes that tie fall to
                        // the lower angle every time instead of to whichever
                        // way the rounding went.
                        if (diff >= best - 1e-9) continue;
                        if (!canPlace(id, test, objects)) continue;
                        best = diff;
                        angle = test;
                    }
                    // Past a quarter turn it is not the freed ground any more,
                    // it is just a placement.
                    if (best > Math.PI / 2) angle = null;
                }

                if (angle === null) continue;

                place(id, angle);
                placedAngles.push(angle);
            }

            vacatedObjects.length = 0;
        }

        function updateAngles(id) {
            const angles = [];
            for (let i = 0; i < 72; i++) {
                const angle = UTILS.toRad(i * (360 / 72));
                angles.push({ id: id, angle: angle, placeable: canPlace(id, angle), ...getConfig(id, angle) });
            }

            getPerfectAngles(angles);

            // Check placed angles and ban them if still placeable
            for (let placedAngle of placedAngles) {
                const matchingAngle = angles.find(a => Math.abs(a.angle - placedAngle) < 0.01); // Small tolerance for float comparison
                if (matchingAngle && matchingAngle.placeable) {
                    bannedAngles.set(placedAngle, tick + 18);
                }
            }

            checkPredictObjects(angles);
        }

        function updateAngles2(id) {
            const angles = [];
            for (let i = 0; i < 36; i++) {
                const angle = UTILS.toRad(i * (360 / 36));
                angles.push({ id: id, angle: angle, placeable: canPlace(id, angle) && checkEnemyTraps(id, angle), ...getConfig(id, angle) });
            }

            getPerfectAngles(angles);
            checkPredictObjects(angles);
        }

        function checkPredictObjects(angles) {
            // Filter placeable angles that are not banned
            const validAngles = angles.filter(obj => {
                if (bannedAngles.has(obj.angle)) return false;
                if (!obj.placeable && !obj.perfect) return false;
                return true;
            });

            if (!nearestEnemy) return false;

            // Find closest spike that will hit enemy
            const closestSpikeToEnemy = validAngles
            .filter(a => {
                if (a.id !== myPlayer.items[2]) return false;
                return UTILS.lineInRect(
                    a.x - (nearestEnemy.scale + a.scale - 1),
                    a.y - (nearestEnemy.scale + a.scale - 1),
                    a.x + (nearestEnemy.scale + a.scale - 1),
                    a.y + (nearestEnemy.scale + a.scale - 1),
                    nearestEnemy.x2, nearestEnemy.y2,
                    nearestEnemy.xVel, nearestEnemy.yVel
                );
            })
            .sort((a, b) =>
                  UTILS.getDistance(nearestEnemy.xVel, nearestEnemy.yVel, a.x, a.y) -
                  UTILS.getDistance(nearestEnemy.xVel, nearestEnemy.yVel, b.x, b.y)
                 )[0];

            // Find closest trap that will hit enemy
            const closestTrapToEnemy = validAngles
            .filter(a => {
                if (a.id !== myPlayer.items[4]) return false;
                return UTILS.lineInRect(
                    a.x - a.scale,
                    a.y - a.scale,
                    a.x + a.scale,
                    a.y + a.scale,
                    nearestEnemy.x2, nearestEnemy.y2,
                    nearestEnemy.xVel, nearestEnemy.yVel
                );
            })
            .sort((a, b) =>
                  UTILS.getDistance(nearestEnemy.xVel, nearestEnemy.yVel, a.x, a.y) -
                  UTILS.getDistance(nearestEnemy.xVel, nearestEnemy.yVel, b.x, b.y)
                 )[0];

            // Find closest spike that will knockback enemy into other spikes with best alignment
            const closestSpikeToKb = (() => {
                const validKbAngles = validAngles
                .filter(a => {
                    if (a.id !== myPlayer.items[2]) return false;

                    const canHitEnemy = UTILS.lineInRect(
                        a.x - (nearestEnemy.scale + a.scale - 1),
                        a.y - (nearestEnemy.scale + a.scale - 1),
                        a.x + (nearestEnemy.scale + a.scale - 1),
                        a.y + (nearestEnemy.scale + a.scale - 1),
                        nearestEnemy.x2, nearestEnemy.y2,
                        nearestEnemy.xVel, nearestEnemy.yVel
                    );

                    if (!canHitEnemy) return false;

                    // Check if knockback will push enemy into our spikes
                    const knockbackAngle = Math.atan2(nearestEnemy.yVel - a.y, nearestEnemy.xVel - a.x);
                    const projectedX = nearestEnemy.xVel + 200 * Math.cos(knockbackAngle);
                    const projectedY = nearestEnemy.yVel + 200 * Math.sin(knockbackAngle);

                    for (let spike of spikes_our) {
                        if (UTILS.lineInRect(
                            spike.x - spike.scale, spike.y - spike.scale,
                            spike.x + spike.scale, spike.y + spike.scale,
                            nearestEnemy.xVel, nearestEnemy.yVel,
                            projectedX, projectedY
                        )) {
                            return true;
                        }
                    }
                    return false;
                })
                .map(a => {
                    // Calculate alignment score
                    const knockbackAngle = Math.atan2(nearestEnemy.yVel - a.y, nearestEnemy.xVel - a.x);
                    const projectedX = nearestEnemy.xVel + 200 * Math.cos(knockbackAngle);
                    const projectedY = nearestEnemy.yVel + 200 * Math.sin(knockbackAngle);

                    let bestAlignment = Infinity;

                    for (let spike of spikes_our) {
                        if (UTILS.lineInRect(
                            spike.x - spike.scale, spike.y - spike.scale,
                            spike.x + spike.scale, spike.y + spike.scale,
                            nearestEnemy.xVel, nearestEnemy.yVel,
                            projectedX, projectedY
                        )) {
                            const angleToEnemy = Math.atan2(nearestEnemy.yVel - a.y, nearestEnemy.xVel - a.x);
                            const enemyToSpike = Math.atan2(spike.y - nearestEnemy.yVel, spike.x - nearestEnemy.xVel);

                            let angleDiff = Math.abs(angleToEnemy - enemyToSpike);
                            if (angleDiff > Math.PI) angleDiff = 2 * Math.PI - angleDiff;

                            bestAlignment = Math.min(bestAlignment, angleDiff);
                        }
                    }

                    return { angle: a, alignment: bestAlignment };
                });

                if (validKbAngles.length === 0) return undefined;

                // Find the best alignment score
                const bestAlignmentScore = Math.min(...validKbAngles.map(v => v.alignment));

                // Filter to only angles with the best alignment, then pick closest to enemy
                return validKbAngles
                    .filter(v => v.alignment === bestAlignmentScore)
                    .sort((a, b) =>
                          UTILS.getDistance(nearestEnemy.xVel, nearestEnemy.yVel, a.angle.x, a.angle.y) -
                          UTILS.getDistance(nearestEnemy.xVel, nearestEnemy.yVel, b.angle.x, b.angle.y)
                         )[0]?.angle;
            })();



            for (let object of validAngles.filter(obj => obj.perfect)) {
                if (isAutoPlaceAngle(object, closestSpikeToEnemy, closestTrapToEnemy, closestSpikeToKb)) {
                    addPredictObject(object.id, object.angle, false);

                }
            }

            for (let object of validAngles.filter(obj => obj.placeable)) {
                if (isAutoPlaceAngle(object, closestSpikeToEnemy, closestTrapToEnemy, closestSpikeToKb)) {
                    addPredictObject(object.id, object.angle, false);
                }
            }
        }

        function getPrePlaceAngles(id, customObjects) {
            const angles = [];
            for (let i = 0; i < 72; i++) {
                const angle = UTILS.toRad(i * (360 / 72));
                angles.push({ id: id, angle: angle, placeable: canPlace(id, angle, customObjects), ...getConfig(id, angle) });
            }

            getPerfectAngles(angles);
            return angles;
        }

        function getPerfectAngles(angles) {
            for (let i in angles) {
                angles[i].perfect = false;

                if (i < 1) continue;

                if (angles[i].placeable && !angles[i - 1].placeable) {
                    angles[i].perfect = true;
                }

                if (angles[i - 1].placeable && !angles[i].placeable) {
                    angles[i - 1].perfect = true;
                }
            }
        }

        function isPrePlaceAngle(config, prePlaceObject, closestSpikeToEnemy, closestTrapToEnemy, closestSpikeToKb) {
            if (!nearestEnemy) return false;
            if (UTILS.getDistance(nearestEnemy.x2, nearestEnemy.y2, myPlayer.x2, myPlayer.y2) > 350) return false;

            const isSpike = config.id === myPlayer.items[2] && !isItemLimit(myPlayer.items[2]);
            const isTrap = config.id === myPlayer.items[4] && !isItemLimit(myPlayer.items[4]);

            const enemyTrapped = traps_our.find(trap =>
                                                UTILS.getDistance(trap.x, trap.y, nearestEnemy.x2, nearestEnemy.y2) < trap.scale
                                               );

            // Calculate future position for line-of-sight checks
            const LOOKAHEAD = 222;
            const START_OFFSET = 35;
            const futureX = myPlayer.x2 + Math.cos(predictMoveAngle) * LOOKAHEAD;
            const futureY = myPlayer.y2 + Math.sin(predictMoveAngle) * LOOKAHEAD;
            const startX = myPlayer.x2 + Math.cos(predictMoveAngle) * START_OFFSET;
            const startY = myPlayer.y2 + Math.sin(predictMoveAngle) * START_OFFSET;

            // Check if spike blocks line of sight to future position
            const spikeWillBlockLOSToFuture = UTILS.lineInRect(
                config.x - config.scale - 5,
                config.y - config.scale - 5,
                config.x + config.scale + 5,
                config.y + config.scale + 5,
                startX, startY,
                futureX, futureY
            );



            // Check if spike blocks line of sight to enemy
            const spikeWillBlockLOSToEnemy = UTILS.lineInRect(
                config.x - config.scale - 5,
                config.y - config.scale - 5,
                config.x + config.scale + 5,
                config.y + config.scale + 5,
                myPlayer.xVel, myPlayer.yVel,
                nearestEnemy.xVel, nearestEnemy.yVel
            );

            let canSpikeTick = UTILS.getDistance(config.x, config.y, nearestEnemy.x2, nearestEnemy.y2) < config.scale + 35;

            let canRetrap = UTILS.getDistance(config.x, config.y, nearestEnemy.x2, nearestEnemy.y2) < 50;

            if (canSpikeTick) {
                // Knockback direction: from spike to enemy
                let kbAngle = Math.atan2(nearestEnemy.y2 - config.y, nearestEnemy.x2 - config.x);

                // Direction from enemy to player
                let enemyToPlayerAngle = Math.atan2(myPlayer.y - nearestEnemy.y2, myPlayer.x - nearestEnemy.x2);

                // Check if knockback direction is similar to enemy->player direction
                let angleDiff = Math.abs(kbAngle - enemyToPlayerAngle);
                if (angleDiff > Math.PI) angleDiff = 2 * Math.PI - angleDiff;

                // If knockback would push enemy towards player (angle diff < 90°), it's BAD
                canSpikeTick = angleDiff >= Math.PI / 5;
            }


            if (isSpike && canSpikeTick && (canTrapTick() || canTrapTick2()))
                return true;

            if (isTrap && canRetrap && canShamePlace())
                return true;



            // Priority 1: Place spike if it hits trapped enemy
            if (isSpike && enemyTrapped && prePlaceObject !== enemyTrapped && closestSpikeToEnemy && config === closestSpikeToEnemy) {
                return true;
            }

            // Priority 2: Retrap colliding enemy
            if (isTrap && nearestEnemy.spikeDamage > 0 && enemyTrapped && prePlaceObject === enemyTrapped && closestTrapToEnemy && config === closestTrapToEnemy) {
                return true;
            }

            // Priority 3: Place spike that knockbacks enemy into other spikes
            if (isSpike && closestSpikeToKb && config === closestSpikeToKb && !canShamePlace()) {
                return true;
            }

            // Priority 4: Place spikes that don't block LOS when enemy is trapped
            if (isSpike && enemyTrapped && !spikeWillBlockLOSToFuture && !spikeWillBlockLOSToEnemy && prePlaceObject !== enemyTrapped) {
                return true;
            }

            // Priority 6: Place trap when neither player is trapped
            if (isTrap) {
                return true;
            }

            return false;
        }


        function isAutoPlaceAngle(config, closestSpikeToEnemy, closestTrapToEnemy, closestSpikeToKb) {
            if (!nearestEnemy) return false;
            if (UTILS.getDistance(nearestEnemy.x2, nearestEnemy.y2, myPlayer.x2, myPlayer.y2) > 350) return false;

            const isSpike = config.id === myPlayer.items[2] && !isItemLimit(myPlayer.items[2]);
            const isTrap = config.id === myPlayer.items[4] && !isItemLimit(myPlayer.items[4]);

            const enemyTrapped = traps_our.find(trap =>
                                                UTILS.getDistance(trap.x, trap.y, nearestEnemy.x2, nearestEnemy.y2) < trap.scale
                                               );

            // Calculate future position for line-of-sight checks
            const LOOKAHEAD = 222;
            const START_OFFSET = 35;
            const futureX = myPlayer.x2 + Math.cos(predictMoveAngle) * LOOKAHEAD;
            const futureY = myPlayer.y2 + Math.sin(predictMoveAngle) * LOOKAHEAD;
            const startX = myPlayer.x2 + Math.cos(predictMoveAngle) * START_OFFSET;
            const startY = myPlayer.y2 + Math.sin(predictMoveAngle) * START_OFFSET;

            // Check if spike blocks line of sight to future position
            const spikeWillBlockLOSToFuture = UTILS.lineInRect(
                config.x - config.scale - 5,
                config.y - config.scale - 5,
                config.x + config.scale + 5,
                config.y + config.scale + 5,
                startX, startY,
                futureX, futureY
            );

            // Check if spike blocks line of sight to enemy
            const spikeWillBlockLOSToEnemy = UTILS.lineInRect(
                config.x - config.scale - 5,
                config.y - config.scale - 5,
                config.x + config.scale + 5,
                config.y + config.scale + 5,
                myPlayer.xVel, myPlayer.yVel,
                nearestEnemy.xVel, nearestEnemy.yVel
            );

            // Check if trap will retrap enemy
            const willRetrap = UTILS.lineInRect(
                config.x - config.scale,
                config.y - config.scale,
                config.x + config.scale,
                config.y + config.scale,
                nearestEnemy.xVel,
                nearestEnemy.yVel
            );




            // Spike placement logic
            if (isSpike) {
                // Priority 1: Place spike if it hits trapped enemy
                if (enemyTrapped && closestSpikeToEnemy && config === closestSpikeToEnemy) {
                    return true;
                }

                // Priority 2: Place spike that knockbacks enemy into other spikes
                if (closestSpikeToKb && config === closestSpikeToKb) {
                    return true;
                }

                // Priority 3: Place spikes that don't block LOS when enemy is trapped
                if (enemyTrapped && !spikeWillBlockLOSToFuture && !spikeWillBlockLOSToEnemy) {
                    return true;
                }
            }

            // Trap placement logic
            if (isTrap) {
                const neitherTrapped = !enemyTrapped && !imTrapped;

                // Priority 1: Place closest trap that will retrap enemy
                if (closestTrapToEnemy && config === closestTrapToEnemy && willRetrap && neitherTrapped) {
                    return true;
                }

                // Priority 2: Place trap when neither player is trapped
                if (neitherTrapped) {
                    return true;
                }
            }

            return false;
        }

        function getClosestConfig(configs) {
            if (!configs || configs.length === 0) return null;

            return configs.reduce((closest, c) => {
                let distC = UTILS.getDistance(c.x, c.y, nearestEnemy.xVel, nearestEnemy.yVel);
                let distClosest = UTILS.getDistance(closest.x, closest.y, nearestEnemy.xVel, nearestEnemy.yVel);
                return distC < distClosest ? c : closest;
            }, configs[0]);
        };

        function getPrePlaceObject() {
            let findObject;

            if (autogathering) {
                if ((predictWeapon < 9 && primaryReload[myPlayer.sid] == 1) || (predictWeapon > 8 && secondaryReload[myPlayer.sid] == 1)) {
                    let dmg = items.weapons[predictWeapon].dmg * (items.weapons[predictWeapon].sDmg || 1) * (config.weaponVariants[myPlayer.weaponVariants[predictWeapon]].val) * (isBoughtHat(40, 0) ? 3.3 : 1);

                    findObject = visibleObjects.filter((object) => (UTILS.getDistance(myPlayer.xVel, myPlayer.yVel, object.x, object.y) - object.scale) <= items.weapons[predictWeapon].range
                                                       && UTILS.getAngleDist(UTILS.getDirection(object.x, object.y, myPlayer.xVel, myPlayer.yVel), getAttackDir()) <= config.gatherAngle
                                                       && object.health <= dmg).sort((a, b) => UTILS.getDistance(a.x, a.y, nearestEnemy.x2, nearestEnemy.y2) - UTILS.getDistance(b.x, b.y, nearestEnemy.x2, nearestEnemy.y2))[0];
                }
            }

            if (nearestEnemy && !findObject) {
                let weapon = null;
                if (nearestEnemy.weapons[1] == 10 && secondaryReload[nearestEnemy.sid] == 1 && nearestEnemy.lastSecondaryReload < secondaryReload[nearestEnemy.sid]) {
                    weapon = nearestEnemy.weapons[1];
                } else {
                    if (items.weapons[nearestEnemy.weapons[0]].speed <= 400 && primaryReload[nearestEnemy.sid] == 1 && nearestEnemy.lastPrimaryReload < primaryReload[nearestEnemy.sid]) {
                        weapon = nearestEnemy.weapons[0];
                    }
                }

                if (weapon != null) {
                    let dmg = items.weapons[weapon].dmg * (items.weapons[weapon].sDmg || 1) * (config.weaponVariants[nearestEnemy.weaponVariants[weapon]].val || 1) * 3.3;

                    findObject = visibleObjects.filter((object) => !object.hideFromEnemy && UTILS.getDistance(nearestEnemy.x2, nearestEnemy.y2, object.x, object.y) <= (object.scale + items.weapons[weapon].range)
                                                       && object.health <= dmg).sort((a, b) => UTILS.getDistance(a.x, a.y, nearestEnemy.x2, nearestEnemy.y2) - UTILS.getDistance(b.x, b.y, nearestEnemy.x2, nearestEnemy.y2))[0];
                }
            }

            if (findObject) {
                spamPrePlacer = true;
            }

            return findObject;
        }

        function getPredictObjects() {
            // FIX STACK PACKETS
            if (removedObjects.length > 0) {
                if (lastPrePlaceObject && removedObjects.some((sid) => lastPrePlaceObject.sid == sid)) {
                    for (const object of predictObjects) {
                        if (!object.preplace) continue;

                        placeTick = tick;
                    }
                }

                removedObjects = [];
            }

            predictObjects = [];

            // PRE PLACER
            lastPrePlaceObject = null;
            spamPrePlacer = false;

            if (window.vars.prePlace && nearestEnemy &&
                UTILS.getDistance(myPlayer.x2, myPlayer.y2, nearestEnemy.x2, nearestEnemy.y2) < 300 &&
                !(nearestTrap && spikeDmgCount > 0)
               ) {
                let findObject = getPrePlaceObject();
                smartTickSpike = null;

                if (findObject) {
                    let customObjects = visibleObjects.slice();
                    customObjects.splice(customObjects.indexOf(findObject), 1);
                    let findAngle;

                    const spikeAngles = getPrePlaceAngles(myPlayer.items[2], customObjects);
                    const trapAngles = getPrePlaceAngles(myPlayer.items[4] || 15, customObjects);

                    let closestSpikeToEnemy = null;
                    let closestTrapToEnemy = null;
                    let closestSpikeToKb = null;

                    let bestSpikeDist = Infinity;
                    let bestTrapDist = Infinity;
                    let bestKbDist = Infinity;

                    // 🔥 SINGLE LOOP FOR SPIKES
                    for (let a of spikeAngles) {
                        if (!a.placeable) continue;

                        // hit check
                        if (UTILS.lineInRect(
                            a.x - (nearestEnemy.scale + a.scale - 1),
                            a.y - (nearestEnemy.scale + a.scale - 1),
                            a.x + (nearestEnemy.scale + a.scale - 1),
                            a.y + (nearestEnemy.scale + a.scale - 1),
                            nearestEnemy.x2, nearestEnemy.y2,
                            nearestEnemy.xVel, nearestEnemy.yVel
                        )) {
                            let dist = UTILS.getDistance(nearestEnemy.xVel, nearestEnemy.yVel, a.x, a.y);
                            if (dist < bestSpikeDist) {
                                bestSpikeDist = dist;
                                closestSpikeToEnemy = a;
                            }
                        }

                        // 🔥 knockback calc (lighter)
                        const kbAngle = Math.atan2(nearestEnemy.yVel - a.y, nearestEnemy.xVel - a.x);
                        const projectedX = nearestEnemy.xVel + 200 * Math.cos(kbAngle);
                        const projectedY = nearestEnemy.yVel + 200 * Math.sin(kbAngle);

                        for (let spike of spikes_our) {
                            if (UTILS.lineInRect(
                                spike.x - spike.scale, spike.y - spike.scale,
                                spike.x + spike.scale, spike.y + spike.scale,
                                nearestEnemy.xVel, nearestEnemy.yVel,
                                projectedX, projectedY
                            )) {
                                let dist = UTILS.getDistance(nearestEnemy.xVel, nearestEnemy.yVel, a.x, a.y);
                                if (dist < bestKbDist) {
                                    bestKbDist = dist;
                                    closestSpikeToKb = a;
                                    smartTickSpike = spike;
                                }
                                break; // 🔥 stop early
                            }
                        }
                    }

                    // 🔥 SINGLE LOOP FOR TRAPS
                    for (let a of trapAngles) {
                        if (!a.placeable) continue;

                        if (UTILS.lineInRect(
                            a.x - a.scale,
                            a.y - a.scale,
                            a.x + a.scale,
                            a.y + a.scale,
                            nearestEnemy.x2, nearestEnemy.y2,
                            nearestEnemy.xVel, nearestEnemy.yVel
                        )) {
                            let dist = UTILS.getDistance(nearestEnemy.xVel, nearestEnemy.yVel, a.x, a.y);
                            if (dist < bestTrapDist) {
                                bestTrapDist = dist;
                                closestTrapToEnemy = a;
                            }
                        }
                    }

                    const getFindAngle = function (findAngleFunc) {
                        if (findAngle) return;

                        findAngleFunc();
                        if (findAngle) {
                            addPredictObject(findAngle.id, findAngle.angle, true);
                        }
                    }

                    getFindAngle(function () {
                        const object = spikeAngles
                        .filter(obj => obj.placeable)
                        .filter(obj => isPrePlaceAngle(obj, findObject, closestSpikeToEnemy, closestTrapToEnemy, closestSpikeToKb))
                        .sort((a, b) => UTILS.getDistance(findObject.x, findObject.y, a.x, a.y) - UTILS.getDistance(findObject.x, findObject.y, b.x, b.y))[0];

                        if (object) {
                            findAngle = object;
                        }
                    });

                    getFindAngle(function () {
                        const object = trapAngles
                        .filter(obj => obj.placeable)
                        .filter(obj => isPrePlaceAngle(obj, findObject, closestSpikeToEnemy, closestTrapToEnemy, closestSpikeToKb))
                        .sort((a, b) => UTILS.getDistance(findObject.x, findObject.y, a.x, a.y) - UTILS.getDistance(findObject.x, findObject.y, b.x, b.y))[0];

                        if (object) {
                            findAngle = object;
                        }
                    });
                    for (let i in predictObjects) {
                        if (!predictObjects[i].preplace) continue;

                        lastPrePlaceObject = findObject;
                        break;
                    }
                }
            }
            // GET AUTOPLACE ANGLES
            if (window.vars.autoPlace && nearestEnemy) {
                setPlaceTick();
                updateAngles(myPlayer.items[2]);
                updateAngles(myPlayer.items[4] || 15);
            }

            setPlaceTick();

            // SHIT AUTO MILLS
            if (autoMills && lastMoveAngle != null && !nearestTrap) {
                let angle = lastMoveAngle + UTILS.toRad(180);
                if (canPlace(myPlayer.items[3], angle)) {
                    if (canPlace(myPlayer.items[3], angle)) {
                        addPredictObject(myPlayer.items[3], angle, false);
                    }

                    if (canPlace(myPlayer.items[3], angle - UTILS.toRad(items.list[myPlayer.items[3]].scale + items.list[myPlayer.items[3]].scale / 2))) {
                        addPredictObject(myPlayer.items[3], angle - UTILS.toRad(items.list[myPlayer.items[3]].scale + items.list[myPlayer.items[3]].scale / 2), false);
                    }

                    if (canPlace(myPlayer.items[3], angle + UTILS.toRad(items.list[myPlayer.items[3]].scale + items.list[myPlayer.items[3]].scale / 2))) {
                        addPredictObject(myPlayer.items[3], angle + UTILS.toRad(items.list[myPlayer.items[3]].scale + items.list[myPlayer.items[3]].scale / 2), false);
                    }
                }
            }
            if(trapPress) {
                let angle = getAttackDir();
                if(canPlace(myPlayer.items[4], angle)) {
                    addPredictObject(myPlayer.items[4], angle, false);
                }
            }
            else if(turretPress) {
                let angle = getAttackDir();
                if(canPlace(myPlayer.items[5], angle)) {
                    addPredictObject(myPlayer.items[5], angle, false);
                }
            }
            else if(spikePress) {
                let angle = getAttackDir();
                if(canPlace(myPlayer.items[2], angle)) {
                    addPredictObject(myPlayer.items[2], angle, false);
                }
            }

            if(grindObjects && grindObjects.length > 0) {
                for (let grindObj of grindObjects) {
                    addPredictObject(grindObj.id, grindObj.angle, grindObj.preplace);
                }
            }
        }

        function setPlaceTick() {
            for (let i in predictObjects) {
                if (predictObjects[i].preplace) continue;

                placeTick = tick;
                break;
            }
        }

        function getHatInStore(id) {
            for (let hat of hats) {
                if (hat.id == id) {
                    return hat;
                }
            }

            return {};
        }

        function getAccInStore(id) {
            for (let acc of accessories) {
                if (acc.id == id) {
                    return acc;
                }
            }

            return {};
        }

        function doWeaponStuff(player) {
            if (player.buildIndex < 0) {
                player.weaponVariants[player.weaponIndex] = player.weaponVariant;

                if (player.weaponIndex < 9) {
                    if (player != myPlayer) {
                        player.weapons[0] = player.weaponIndex;
                    }

                    primaryReload[player.sid] = Math.min(1, primaryReload[player.sid] + (player.t2 - player.t1) / items.weapons[player.weaponIndex].speed);
                } else {
                    if (player != myPlayer) {
                        player.weapons[1] = player.weaponIndex;
                    }

                    if (player.weaponIndex != 11) {
                        secondaryReload[player.sid] = Math.min(1, secondaryReload[player.sid] + (player.t2 - player.t1) / items.weapons[player.weaponIndex].speed);
                    }
                }
            }

            turretReload[player.sid] = Math.min(1, turretReload[player.sid] + (player.t2 - player.t1) / 2500);
        }

        // UPDATE HEALTH:
        function updateHealth(sid, value) {
            tmpObj = findPlayerBySID(sid);
            if (tmpObj) {
                let damage = tmpObj.health - value;
                tmpObj.health = value;

                if (damage > 0) {
                    tmpObj.hitTime = Date.now();

                    if (tmpObj == myPlayer) {
                        damageTick = (tick + 1);

                        damages.push(UTILS.fixTo(damage, 2));
                        deathDamages.push({ damage: UTILS.fixTo(damage, 2), tick: damageTick });
                    } else {
                        if ([20, 30, 35, 45, (20 * .75), (30 * .75), (35 * .75), (45 * .75)].includes(damage)) {
                            tmpObj.spikeDamage = damage;
                        }
                    }
                } else {
                    if (tmpObj.hitTime) {
                        let o = Date.now() - tmpObj.hitTime;
                        if (o <= 120) {
                            tmpObj.shameCount = tmpObj.shameCount + 1;
                        } else {
                            tmpObj.shameCount = Math.max(0, tmpObj.shameCount - 2);
                        }

                        tmpObj.hitTime = null;
                    }

                    if (tmpObj == myPlayer && tmpObj.health == 100) {
                        deathDamages = [];
                        spikeDmg = 0;
                    }
                }
            }
        }

        function projectileHandle(projectile) {
            let player = projectile.player;
            if (player == null) return;

            if (!isAlly(player.sid)) {
                if (projectile.weapon == "turret" && UTILS.getDistance(myPlayer.x2, myPlayer.y2, player.x2, player.y2) > 200 && UTILS.getDistance(myPlayer.x2, myPlayer.y2, player.x2, player.y2) < 300
                    && canShoot(projectile) && primaryReload[player.sid] == 1) {
                    antiOneTick(UTILS.getDistance(myPlayer.x2, myPlayer.y2, projectile.x, projectile.y) / projectile.speed);
                }
            }
        }

        function canShoot(projectile) {
            let config = {
                x: projectile.x + projectile.range * Math.cos(projectile.dir),
                y: projectile.y + projectile.range * Math.sin(projectile.dir),
                sid: projectile.object != null ? projectile.object.owner.sid : projectile.player.sid,
            };

            if (config.sid == myPlayer.sid || isAlly(config.sid)) {
                return false;
            }

            if (UTILS.lineInRect(myPlayer.x2 - 35, myPlayer.y2 - 35, myPlayer.x2 + 35, myPlayer.y2 + 35, projectile.x, projectile.y, config.x, config.y)) {
                let filterObjects = [];
                let types = [10, 11, 12, 17];
                for (let object of visibleObjects) {
                    if (object.ignoreCollision) continue;

                    if (projectile.weapon == "turret") {
                        if (projectile.object != null && object.sid == projectile.object.sid) continue;

                        if (types.includes(object.id) || (object.type != null && object.type != 2)) {
                            filterObjects.push(object);
                        }
                    } else {
                        filterObjects.push(object);
                    }
                }

                let nearestFind = filterObjects.filter((object) => UTILS.lineInRect(object.x - object.getScale(), object.y - object.getScale(), object.x + object.getScale(), object.y + object.getScale(), projectile.x, projectile.y, config.x, config.y))
                .sort((a, b) => UTILS.getDistance(a.x, a.y, projectile.x, projectile.y) - UTILS.getDistance(b.x, b.y, projectile.x, projectile.y))[0];

                if (nearestFind && UTILS.getDistance(nearestFind.x, nearestFind.y, projectile.x, projectile.y) < UTILS.getDistance(myPlayer.x2, myPlayer.y2, projectile.x, projectile.y)) {
                    return false;
                }

                return true;
            }

            return false;
        }

        function antiOneTick(speed) {
            antiTick = true;
            clearTimeout(antiTickTimeout);
            antiTickTimeout = setTimeout(function () {
                antiTick = false;
            }, speed);
        }

        function distributionDamages(object) {
            if (object.type == "hit") {
                const { weapon, player } = object;

                let damage = items.weapons[weapon].dmg * config.weaponVariants[player.weaponVariants[weapon]].val;

                damage *= (getHatInStore(player.skinIndex).dmgMultO || 1);
                damage *= (getAccInStore(player.tailIndex).dmgMultO || 1);

                damage *= (getHatInStore(myPlayer.skinIndex).dmgMult || 1);
                damage = UTILS.fixTo(damage, 2);

                for (let i in damages) {
                    if (damages[i] == damage) {
                        damagesByHits.push({ damage: damage, player: player, weapon: weapon });
                        damages.splice(i, 1);

                        break;
                    }
                }
            } else if (object.type == "shoot") {
                const { projectile } = object;

                let damage = projectile.dmg * (getHatInStore(myPlayer.skinIndex).dmgMult || 1);
                damage = UTILS.fixTo(damage, 2);

                for (let i in damages) {
                    if (damages[i] == damage) {
                        damagesByShoots.push({ projectile: projectile, damage: damage });
                        damages.splice(i, 1);

                        break;
                    }
                }
            } else if (object.type == "spikes") {
                for (let damage of damages) {
                    if (damage == 20 || damage == 30 || damage == 35 || damage == 45 || damage == (20 * .75) || damage == (30 * .75) || damage == (35 * .75) || damage == (45 * .75)) {
                        spikeDamages.push(damage);
                    }
                }

                for (let damage of spikeDamages) {
                    damages.splice(damages.indexOf(damage), 1);
                }
            }
        }

        function changeObjectHealth(player, weapon, damageObjects) {
            let dmg = items.weapons[weapon].dmg * (items.weapons[weapon].sDmg || 1) * (player.skinIndex == 40 ? 3.3 : 1) * config.weaponVariants[player.weaponVariants[weapon]].val;
            for (let object of damageObjects) {
                object.health -= dmg;
            }
        }

        function getPlayerInfo(player, type) {
            if (!player) return null;

            const playerPrimary = player.weapons[0] || 5;
            const playerSecondary = player.weapons[1] || 15;
            const primaryVariant = player.weaponVariants[playerPrimary] ?? 2;
            const secondaryVariant = player.weaponVariants[playerSecondary] ?? 2;
            var tankMultiplier = 1;
            if (player == myPlayer) {
                if (isBoughtHat(40, 0)) {
                    tankMultiplier = 3.3;
                }
            }
            else {
                tankMultiplier = 3.3;
            }

            // Weapon ID constants
            const TOOL_HAMMER = 0;
            const AXE = 1;
            const GREAT_AXE = 2;
            const SHORT_SWORD = 3;
            const KATANA = 4;
            const POLEARM = 5;
            const BAT = 6;
            const DAGGERS = 7;
            const STICK = 8;
            const BOW = 9;
            const HAMMER = 10;
            const SHIELD = 11;
            const CROSSBOW = 12;
            const REPEATER = 13;
            const MCGRABBY = 14;
            const MUSKET = 15;

            const secondaryWeapons = {
                [BOW]: "bow",
                [HAMMER]: "hammer",
                [SHIELD]: "shield",
                [CROSSBOW]: "crossbow",
                [REPEATER]: "repeater crossbow",
                [MCGRABBY]: "mcgrabby",
                [MUSKET]: "musket"
            };

            const primaryWeapons = {
                [TOOL_HAMMER]: "tool hammer",
                [AXE]: "axe",
                [GREAT_AXE]: "great axe",
                [SHORT_SWORD]: "short sword",
                [KATANA]: "katana",
                [POLEARM]: "polearm",
                [BAT]: "bat",
                [DAGGERS]: "daggers",
                [STICK]: "stick"
            };

            // Helper function for variant multiplier
            const getVariantMultiplier = (variant) => config.weaponVariants[variant]?.val || 1;

            // Ranged secondary weapons
            const rangedSecondaries = [BOW, CROSSBOW, REPEATER, MUSKET];

            if (type == "secondaryWeapon")
                return secondaryWeapons[playerSecondary];

            if (type == "primaryWeapon")
                return primaryWeapons[playerPrimary];

            if (type == "primaryVariant")
                return primaryVariant;

            if (type == "secondaryVariant")
                return secondaryVariant;

            if (type == "primaryRange")
                return items.weapons[playerPrimary].range;

            if (type == "secondaryRange")
                return items.weapons[playerSecondary].range;

            if (type == "primaryDmg")
                return items.weapons[playerPrimary].dmg * 1.5 * getVariantMultiplier(primaryVariant);

            if (type == "primaryStructureDmg")
                return items.weapons[playerPrimary].dmg *
                    (items.weapons[playerPrimary].sDmg || 1) *
                    getVariantMultiplier(primaryVariant) * tankMultiplier;

            if (type == "secondaryDmg") {
                const weapon = items.weapons[playerSecondary];

                // Only hammer deals melee damage
                if (playerSecondary == HAMMER)
                    return weapon.dmg * 1.5 * getVariantMultiplier(secondaryVariant);

                // Ranged secondary weapons with hardcoded damage
                if (playerSecondary == BOW)
                    return 15;
                if (playerSecondary == CROSSBOW)
                    return 30;
                if (playerSecondary == REPEATER)
                    return 35;
                if (playerSecondary == MUSKET)
                    return 50;

                // Shield and McGrabby deal no damage
                return 0;
            }

            if (type == "secondaryStructureDmg") {
                const weapon = items.weapons[playerSecondary];

                // Only hammer deals structure damage
                if (playerSecondary == HAMMER) {
                    return weapon.dmg *
                        (weapon.sDmg || 1) *
                        getVariantMultiplier(secondaryVariant) * tankMultiplier;
                }
                return 0;
            }

            if (type == "primaryKnockback")
                return items.weapons[playerPrimary].knock || 0;

            return null;
        }

        function checkBuildingDamage(projectile, damageObjects) {
            let config = {
                x: projectile.x + projectile.range * Math.cos(projectile.dir),
                y: projectile.y + projectile.range * Math.sin(projectile.dir),
            };

            for (let object of damageObjects) {
                if (!object.ignoreCollision && UTILS.lineInRect(object.x - object.scale, object.y - object.scale, object.x + object.scale, object.y + object.scale, projectile.x, projectile.y, config.x, config.y)) {
                    if (object.id == 3) {
                        object.health -= projectile.dmg;
                    }
                }
            }
        }

        function isSpikeCollisionEnemy(spike) {
            if (nearestEnemy.spikeDamage > 0) {
                return true;
            }
        }

        function canAutoPush() {
            if (lineInCircle(myPlayer.x2, myPlayer.y2, pushPositions.x, pushPositions.y, nearestEnemy.x2, nearestEnemy.y2, 35)) {
                return false;
            }

            for (let object of visibleObjects) {
                if (object.id == 15 && (object.owner.sid == myPlayer.sid || isAlly(object.owner.sid))) continue;

                if (((object.id > 5 && object.id < 10) && object.owner != myPlayer.sid && !isAlly(object.owner)) || object.id == 16 || object.id == 22) {
                    if (lineInCircle(myPlayer.x2, myPlayer.y2, pushPositions.x, pushPositions.y, object.x, object.y, 35 + object.getScale(.6, object.isItem))) {
                        return false;
                    }
                } else {
                    if (lineInCircle(myPlayer.x2, myPlayer.y2, pushPositions.x, pushPositions.y, object.x, object.y, object.getScale(.6, object.isItem) * .75)) {
                        return false;
                    }
                }
            }

            return true;
        }

        let antiPushAngle;
        function isNearestEnemyPushPlayer() {
            if (!nearestEnemy) return false;
            if (visibleObjects.filter((object) => object.id == 15 && UTILS.getDistance(nearestEnemy.x2, nearestEnemy.y2, object.x, object.y) <= 50 && (object.owner.sid == myPlayer.sid || isAlly(object.owner.sid)))[0]) return false;

            if ((nearestTrap && spikeDmgCount < 1) && (myPlayer.weapons[0] == 6 || myPlayer.weapons[0] == 7)) {
                const nearestSpike = enemySpikes.sort((a, b) => UTILS.getDistance(myPlayer.x2, myPlayer.y2, a.x, a.y) - UTILS.getDistance(myPlayer.x2, myPlayer.y2, b.x, b.y))[0];

                if ((nearestTrap && nearestSpike)
                    && UTILS.getDistance(nearestSpike.x, nearestSpike.y, nearestTrap.x, nearestTrap.y) <= (35 + nearestSpike.scale + nearestTrap.scale)
                    && UTILS.getDistance(myPlayer.x2, myPlayer.y2, nearestEnemy.xVel, nearestEnemy.yVel) <= (35 * 1.8 + items.weapons[myPlayer.weapons[0]].range)) {
                    antiPushAngle = Math.atan2(nearestEnemy.y2 - myPlayer.y2, nearestEnemy.x2 - myPlayer.x2);
                    return true;
                }
            }

            return false;
        }
        function updatePredictEnemyTraps() {
            let objects = [];
            for (let trap of predictEnemyTraps) {
                if (visibleObjects.find((object) => UTILS.getDistance(trap.x, trap.y, object.x, object.y) < (trap.scale + object.getScale(.6, object.isItem))) || (tick - trap.tick) >= (3 * 10)) {
                    objects.push(trap);
                }
            }

            for (let object of objects) {
                predictEnemyTraps.splice(predictEnemyTraps.indexOf(object), 1);
            }
        }

        let spawnedObjectSids;
        let promiseResolve;

        // UPDATE PLAYER DATA:
        function updatePlayers(data) {
            tick++;



            // BAN ANGLES
            for (let [angle, unbanTick] of bannedAngles.entries()) {
                if (tick >= unbanTick) {
                    bannedAngles.delete(angle);
                }
            }

            enemiesNear = [];
            spawnedObjectSids = [];

            var tmpTime = Date.now();
            for (var i = 0; i < players.length; ++i) {
                players[i].forcePos = !players[i].visible;
                players[i].visible = false;
            }

            for (var i = 0; i < data.length;) {
                tmpObj = findPlayerBySID(data[i]);

                if (tmpObj) {
                    const lastX = tmpObj.x2, lastY = tmpObj.y2;

                    tmpObj.lastPrimaryReload = primaryReload[tmpObj.sid];
                    tmpObj.lastSecondaryReload = secondaryReload[tmpObj.sid];

                    tmpObj.t1 = (tmpObj.t2 === undefined) ? tmpTime : tmpObj.t2;
                    tmpObj.t2 = tmpTime;

                    tmpObj.x1 = tmpObj.x;
                    tmpObj.y1 = tmpObj.y;

                    tmpObj.x2 = data[i + 1];
                    tmpObj.y2 = data[i + 2];

                    tmpObj.xVel = tmpObj.x2 * 2 - lastX;
                    tmpObj.yVel = tmpObj.y2 * 2 - lastY;

                    tmpObj.d1 = (tmpObj.d2 === undefined) ? data[i + 3] : tmpObj.d2;
                    tmpObj.d2 = data[i + 3];

                    tmpObj.dt = 0;

                    tmpObj.buildIndex = data[i + 4];
                    tmpObj.weaponIndex = data[i + 5];
                    tmpObj.weaponVariant = data[i + 6];

                    tmpObj.team = data[i + 7];
                    tmpObj.isLeader = data[i + 8];

                    tmpObj.skinIndex = data[i + 9];
                    tmpObj.tailIndex = data[i + 10];

                    tmpObj.iconIndex = data[i + 11];
                    tmpObj.zIndex = data[i + 12];

                    if (tmpObj.forcePos) {
                        primaryReload[tmpObj.sid] = 1;
                        secondaryReload[tmpObj.sid] = 1;
                        turretReload[tmpObj.sid] = 1;
                    }

                    tmpObj.visible = true;
                    doWeaponStuff(tmpObj);
                }

                i += 13;
            }

            const promise = new Promise(function (resolve, reject) {
                promiseResolve = resolve;

                setTimeout(function () {
                    if (!promiseResolve) return;
                    promiseResolve(false);
                }, 1);
            });

            promise.then(function (newObject) {
                if (tickPromiseResolve) {
                    tickPromiseResolve(true);
                }



                promiseResolve = null;

                // CHECK COLLISION
                for (const object of visibleObjects) {
                    if (object.dmg > 0 || object.ignoreCollision) continue;

                    const tmpLen = 35 + object.getScale();
                    if ((UTILS.getDistance(myPlayer.xVel, myPlayer.yVel, object.x, object.y) - tmpLen) < 0) {
                        const tmpDir = Math.atan2(myPlayer.yVel - object.y, myPlayer.xVel - object.x);

                        myPlayer.xVel = object.x + (tmpLen * Math.cos(tmpDir));
                        myPlayer.yVel = object.y + (tmpLen * Math.sin(tmpDir));
                    }
                }

                updatePredictEnemyTraps();

                for (let i in players) {
                    if (players[i].visible && players[i] != myPlayer && (players[i].team == null || players[i].team != myPlayer.team)) {
                        enemiesNear.push(players[i]);
                    }
                }

                nearestEnemy = enemiesNear.sort((a, b) => UTILS.getDistance(myPlayer.x2, myPlayer.y2, a.x2, a.y2) - UTILS.getDistance(myPlayer.x2, myPlayer.y2, b.x2, b.y2))[0];

                nearestEnemiesCount = 0;
                for (let enemy of enemiesNear) {
                    if (UTILS.getDistance(myPlayer.x2, myPlayer.y2, enemy.x2, enemy.y2) <= 300) {
                        nearestEnemiesCount++;
                    }

                    let trap = visibleObjects.filter(object => object.id == 15 && UTILS.getDistance(enemy.x2, enemy.y2, object.x, object.y) < 50 && (object.owner.sid == myPlayer.sid || isAlly(object.owner.sid)))[0];
                    if (trap && trap.hideFromEnemy) {
                        trap.hideFromEnemy = false;
                    }
                }

                if (objectShoots.length > 0) {
                    for (let shoot of objectShoots) {
                        const { objects, projectile } = shoot;
                        checkBuildingDamage(projectile, objects);
                    }

                    objectShoots = [];
                }

                if (objectHits.length > 0) {
                    for (let objectHit of objectHits) {
                        changeObjectHealth(objectHit.player, objectHit.weapon, objectHit.objects);
                    }

                    objectHits = [];
                }

                // OBJECTS FILTERING
                if (myPlayer) {
                    visibleObjects = gameObjects.filter(object => UTILS.getDistance(object.x, object.y, myPlayer.x2, myPlayer.y2) < 1000);
                    spikes_enemy = visibleObjects.filter(object => object.id > 5 && object.id < 10 && !isObjectOur(object));
                    trap_where_im_in = visibleObjects.filter(object => object.id == 15 && UTILS.getDistance(object.x, object.y, myPlayer.x2, myPlayer.y2) < object.scale && !isObjectOur(object))[0];
                    cactuses = visibleObjects.filter(object => object.type == 1 && object.y >= config.mapScale - config.snowBiomeTop);
                    spikes_our = visibleObjects.filter(object => object.id > 5 && object.id < 10 && isObjectOur(object));
                    traps_our = visibleObjects.filter(object => object.id == 15 && isObjectOur(object));
                    turrets_our = visibleObjects.filter(object => object.id == 17);
                }

                imTrapped = trap_where_im_in;

                // ENEMY SPIKES
                enemySpikes = visibleObjects.filter(object => object.id > 5 && object.id < 10 && object.owner.sid != myPlayer.sid && !isAlly(object.owner.sid));
                let nearestSpike = enemySpikes.sort((a, b) => UTILS.getDistance(myPlayer.x2, myPlayer.y2, a.x, a.y) - UTILS.getDistance(myPlayer.x2, myPlayer.y2, b.x, b.y))[0];

                // NEAREST TRAP
                const lastNearestTrap = nearestTrap;
                if (nearestTrap && removedObjects.some((sid) => nearestTrap.sid == sid)) {
                    trapBreaked = true;
                    trapBreakedTick = tick;
                }

                if (trapBreaked && (tick - trapBreakedTick) > 1) {
                    trapBreaked = false;
                }

                nearestTrap = visibleObjects.filter(object => object.id == 15 && UTILS.getDistance(myPlayer.x2, myPlayer.y2, object.x, object.y) <= 50 && (object.owner.sid != myPlayer.sid && !isAlly(object.owner.sid)))[0];
                // Check if nearestEnemy can reTrap me
                let objects = visibleObjects.filter(object => object != nearestTrap);
                let canRetrap = false;
                if (nearestEnemy)
                    for (let i = 0; i < 36; i++) {
                        let angle = UTILS.toRad(i * (360 / 36));
                        let id = 15;

                        let config = {
                            x: nearestEnemy.x2 + (35 + items.list[id].scale + (items.list[id].placeOffset || 0)) * Math.cos(angle),
                            y: nearestEnemy.y2 + (35 + items.list[id].scale + (items.list[id].placeOffset || 0)) * Math.sin(angle),
                            scale: items.list[id].scale
                        };

                        if (objectManager.checkItemLocation(config.x, config.y, config.scale, 0.6, id, false, nearestEnemy, objects)) {
                            if (UTILS.getDistance(myPlayer.x2, myPlayer.y2, config.x, config.y) <= 50) {
                                canRetrap = true;
                            }
                        }
                    }

                // AUTOBREAK
                const myX = myPlayer.x2;
                const myY = myPlayer.y2;
                const isHammerCached = getPlayerInfo(myPlayer, "secondaryWeapon") == "hammer";
                const isFastPrimaryCached = items.weapons[myPlayer.weapons[0]].speed < 400;
                const primaryDmg = getPlayerInfo(myPlayer, "primaryStructureDmg");
                const primaryRange = getPlayerInfo(myPlayer, "primaryRange");
                const secondaryRange = getPlayerInfo(myPlayer, "secondaryRange");

                // Cache squared ranges to eliminate Math.sqrt()
                const primaryRangeSq = primaryRange * primaryRange;
                const secondaryRangeSq = secondaryRange * secondaryRange;

                if (myPlayer)
                    autoBreakWeapon = myPlayer.weapons[isHammerCached ? 1 : 0];
                breakObject = null;

                // Persistent state initialization (Zero Allocation Strategy)
                if (!window.vars._breakStuckTicks) window.vars._breakStuckTicks = 0;
                if (typeof window.vars._hasRetaliated === "undefined") window.vars._hasRetaliated = false;
                if (!window.vars._ourPathObjects) window.vars._ourPathObjects = [];
                if (!window.vars._pathMode) window.vars._pathMode = { avoidEnemySpikes: false, avoidEnemy: false };
                if (!window.vars._pathPosition) window.vars._pathPosition = { x: 0, y: 0 };
                if (!window.vars._predictMove) window.vars._predictMove = [];

                // Float64Arrays for blazing fast, zero-GC angle scoring
                if (!window.vars._anglesCache) {
                    window.vars._hitAngles = new Float64Array(100);
                    window.vars._hitCones = new Float64Array(100);
                    window.vars._nonHitAngles = new Float64Array(100);
                    window.vars._nonHitCones = new Float64Array(100);
                    window.vars._anglesCache = true;
                }

                // Helper functions (Optimized with squared distances)
                const canOneHitWithPrimary = (obj) => obj.health <= primaryDmg;
                const inPrimaryRange = (obj) => {
                    const r = primaryRange + (obj.scale || 0);
                    return ((myX - obj.x)**2 + (myY - obj.y)**2) <= r * r;
                };
                const inSecondaryRange = (obj) => {
                    const r = secondaryRange + (obj.scale || 0);
                    return ((myX - obj.x)**2 + (myY - obj.y)**2) <= r * r;
                };
                const distToEnemySq = (obj) => nearestEnemy ? ((nearestEnemy.x2 - obj.x)**2 + (nearestEnemy.y2 - obj.y)**2) : Infinity;

                // Weapon selection logic
                const selectWeaponAndBreak = (target) => {
                    if (isFastPrimaryCached && canOneHitWithPrimary(target) && inPrimaryRange(target)) {
                        autoBreakWeapon = myPlayer.weapons[0];
                        breakObject = target;
                    } else if (isHammerCached && inSecondaryRange(target)) {
                        autoBreakWeapon = myPlayer.weapons[1];
                        breakObject = target;
                    } else if (!isHammerCached && inPrimaryRange(target)) {
                        autoBreakWeapon = myPlayer.weapons[0];
                        breakObject = target;
                    } else if (inPrimaryRange(target) && isFastPrimaryCached && imTrapped) {
                        autoBreakWeapon = myPlayer.weapons[0];
                        breakObject = target;
                    }
                };

                // Check for high-priority target interrupts during breaks
                let overrideBreakForCombat = false;
                if (nearestEnemy && breakObject) {
                    const distToEnemyValSq = (myX - nearestEnemy.x2)**2 + (myY - nearestEnemy.y2)**2;
                    const meleeRange = primaryRange + nearestEnemy.scale;
                    const primaryReady = primaryReload[myPlayer.sid] === 1;

                    if (distToEnemyValSq <= meleeRange * meleeRange && primaryReady && !isAlly(nearestEnemy.sid)) {
                        overrideBreakForCombat = true;
                    }
                }

                if (breakObject && !overrideBreakForCombat) {
                    autoBreak = true;
                    // ... Proceed with breaking structures ...
                } else if (overrideBreakForCombat) {
                    autoBreak = false;
                    predictWeapon = myPlayer.weapons[0];
                    autoaimAngle = Math.atan2(nearestEnemy.y2 - myY, nearestEnemy.x2 - myX);
                    autoaim = true;
                } else {
                    if (autoBreak) {
                        autoReload = true;
                        autoBreak = false;
                    }
                }

                // Priority 1: Break enemy traps/spikes when trapped
                if (nearestTrap && nearestTrap.hideFromEnemy) {
                    nearestTrap.hideFromEnemy = false;
                }

                if (nearestTrap && nearestSpike) {
                    if (spikeDmgCount > 0) {
                        if (nearestEnemy && distToEnemySq(nearestTrap) < distToEnemySq(nearestSpike)) {
                            selectWeaponAndBreak(nearestTrap);
                            if (!breakObject) selectWeaponAndBreak(nearestSpike); // Fallback added
                        } else {
                            selectWeaponAndBreak(nearestSpike);
                            if (!breakObject) selectWeaponAndBreak(nearestTrap); // Fallback added
                        }
                    } else {
                        selectWeaponAndBreak(nearestTrap);
                        if (breakObject && canOneHitWithPrimary(nearestTrap)) {
                            if (isHammerCached && inSecondaryRange(nearestSpike)) {
                                selectWeaponAndBreak(nearestSpike);
                            } else if (isFastPrimaryCached && inPrimaryRange(nearestSpike)) {
                                selectWeaponAndBreak(nearestSpike);
                            }
                        } else if (!breakObject) {
                            selectWeaponAndBreak(nearestSpike); // Fallback added
                        }
                    }
                } else if (nearestTrap) {
                    selectWeaponAndBreak(nearestTrap);
                } else if (nearestSpike) {
                    selectWeaponAndBreak(nearestSpike);
                }

                // Single pass for path objects (Zero Allocation)
                const ourPathObjects = window.vars._ourPathObjects;
                ourPathObjects.length = 0;
                let closestPathObject = null;
                let minDistToPathObjSq = Infinity;

                if (pathBreak) {
                    for (let i = 0; i < visibleObjects.length; i++) {
                        const obj = visibleObjects[i];
                        if (isObjectMine(obj) && (obj.id === 15 || (obj.id > 5 && obj.id < 10))) {
                            ourPathObjects.push(obj);
                            if (!breakObject) {
                                const distSq = (myX - obj.x)**2 + (myY - obj.y)**2;
                                if (distSq < minDistToPathObjSq) {
                                    const pR = primaryRange + obj.scale;
                                    const sR = secondaryRange + obj.scale;
                                    if (distSq <= pR * pR || distSq <= sR * sR) {
                                        minDistToPathObjSq = distSq;
                                        closestPathObject = obj;
                                    }
                                }
                            }
                        }
                    }
                }

                // Priority 2: Path break our own objects if no enemy threats
                if (!breakObject && pathBreak && closestPathObject) {
                    if (isHammerCached && inSecondaryRange(closestPathObject)) {
                        autoBreakWeapon = myPlayer.weapons[1];
                        breakObject = closestPathObject;
                    } else if (isFastPrimaryCached && inPrimaryRange(closestPathObject)) {
                        autoBreakWeapon = myPlayer.weapons[0];
                        breakObject = closestPathObject;
                    }
                }

                // ─── CIRCLE / COMBAT MOVEMENT — runs BEFORE angle calculation ────────────────
                shouldntPathfind = false;
                pathPosition = null;
                let pathMode = window.vars._pathMode; // <-- CHANGED FROM const TO let
                pathMode.avoidEnemySpikes = false;
                pathMode.avoidEnemy = false;

                if (pathBreak && ourPathObjects.length > 0) {
                    let closestObject = ourPathObjects[0];
                    let nearestDistSq = (myX - closestObject.x)**2 + (myY - closestObject.y)**2;

                    for (let i = 1; i < ourPathObjects.length; i++) {
                        const obj = ourPathObjects[i];
                        const distSq = (myX - obj.x)**2 + (myY - obj.y)**2;
                        if (distSq < nearestDistSq) {
                            nearestDistSq = distSq;
                            closestObject = obj;
                        }
                    }

                    let nearbyObject = null;
                    const hammerRange2Sq = (secondaryRange * 2)**2;
                    for (let i = 0; i < ourPathObjects.length; i++) {
                        const obj = ourPathObjects[i];
                        if (obj !== closestObject) {
                            const distSq = (closestObject.x - obj.x)**2 + (closestObject.y - obj.y)**2;
                            if (distSq <= hammerRange2Sq) {
                                nearbyObject = obj;
                                break;
                            }
                        }
                    }

                    pathPosition = window.vars._pathPosition;
                    if (nearbyObject) {
                        pathPosition.x = (closestObject.x + nearbyObject.x) / 2;
                        pathPosition.y = (closestObject.y + nearbyObject.y) / 2;
                    } else {
                        const angle = Math.atan2(closestObject.y - myY, closestObject.x - myX);
                        pathPosition.x = closestObject.x - Math.cos(angle) * closestObject.scale;
                        pathPosition.y = closestObject.y - Math.sin(angle) * closestObject.scale;
                    }

                    pathMode.avoidEnemySpikes = true;
                }

                if (nearestEnemy) {
                    // 1. Check if the enemy is trapped
                    let isEnemyTrapped = false;
                    if (typeof traps_our !== "undefined") {
                        for (let i = 0; i < traps_our.length; i++) {
                            const trap = traps_our[i];
                            if ((trap.x - nearestEnemy.x2)**2 + (trap.y - nearestEnemy.y2)**2 < trap.scale * trap.scale) {
                                isEnemyTrapped = true;
                                break;
                            }
                        }
                    }

                    // 2. Smart Circling Logic
                    if (window.vars.autoPlay || (window.vars.circleTrappedEnemy && isEnemyTrapped)) {

                        // Use actual coordinates instead of velocity for accurate math
                        const ex = nearestEnemy.x2 !== undefined ? nearestEnemy.x2 : nearestEnemy.x;
                        const ey = nearestEnemy.y2 !== undefined ? nearestEnemy.y2 : nearestEnemy.y;

                        // Radius 85 is optimal: keeps you outside their hitbox but close enough to place blocks
                        const circleRadius = 85;
                        const rotationSpeed = 0.25; // Slightly faster to wrap around them quickly

                        if (!window.vars.circleDirection) {
                            window.vars.circleDirection = 1;
                        }

                        // Calculate our current angle relative to the enemy
                        const currentAngle = Math.atan2(myY - ey, myX - ex);

                        pathMode.avoidEnemy = true;

                        let targetPos = null;
                        let foundSpot = false;

                        // SCANNER: Look ahead along the circle to find the nearest EMPTY spot to place a spike
                        for (let i = 1; i <= 12; i++) {
                            let testAngle = currentAngle + (rotationSpeed * i * window.vars.circleDirection);
                            let testPos = {
                                x: ex + Math.cos(testAngle) * circleRadius,
                                y: ey + Math.sin(testAngle) * circleRadius
                            };

                            // If this spot around the enemy is empty, target it!
                            if (!isPositionBlocked(testPos, pathMode)) {
                                targetPos = testPos;
                                foundSpot = true;
                                break;
                            }
                        }

                        // If our preferred direction is completely walled off, reverse direction and scan the other way
                        if (!foundSpot) {
                            window.vars.circleDirection *= -1;
                            for (let i = 1; i <= 12; i++) {
                                let testAngle = currentAngle + (rotationSpeed * i * window.vars.circleDirection);
                                let testPos = {
                                    x: ex + Math.cos(testAngle) * circleRadius,
                                    y: ey + Math.sin(testAngle) * circleRadius
                                };

                                if (!isPositionBlocked(testPos, pathMode)) {
                                    targetPos = testPos;
                                    foundSpot = true;
                                    break;
                                }
                            }
                        }

                        // Fallback: If they are 100% surrounded by blocks, just hug the closest block
                        if (!foundSpot) {
                            targetPos = {
                                x: ex + Math.cos(currentAngle) * circleRadius,
                                y: ey + Math.sin(currentAngle) * circleRadius
                            };
                        }

                        pathPosition = targetPos;
                    }
                }

                // ─── ANGLE CALCULATION — runs AFTER movement is finalized ────────────────
                if (breakObject) {
                    autoBreak = true;



                    let enemyTrapped;
                    if (nearestEnemy) {
                        for (let i = 0; i < traps_our.length; i++) {
                            const trap = traps_our[i];
                            if ((trap.x - nearestEnemy.x2)**2 + (trap.y - nearestEnemy.y2)**2 < trap.scale * trap.scale) {
                                enemyTrapped = trap;
                                break;
                            }
                        }
                    }

                    const isPathBreaking = isObjectMine(breakObject);
                    const isTrapped = typeof trap_where_im_in !== "undefined" && !!trap_where_im_in;
                    const predictedX = myX + (!isTrapped && predictMoveAngle !== null ? Math.cos(predictMoveAngle) * 5 : 0);
                    const predictedY = myY + (!isTrapped && predictMoveAngle !== null ? Math.sin(predictMoveAngle) * 5 : 0);

                    const weaponRange = items.weapons[autoBreakWeapon].range;
                    const breakScale = breakObject.scale || 0;
                    const distToBreakSq = (predictedX - breakObject.x)**2 + (predictedY - breakObject.y)**2;
                    const overlapping = distToBreakSq < (breakScale * 1.1)**2;

                    if (overlapping) {
                        const directAngle = distToBreakSq < 1
                        ? (window.vars._lastBreakAngle || 0)
                        : Math.atan2(breakObject.y - predictedY, breakObject.x - predictedX);
                        window.vars._breakStuckTicks = 0;
                        window.vars._lastBreakAngle = directAngle;
                        autoBreakAngle = directAngle;
                    } else {
                        const baseAngle = Math.atan2(breakObject.y - predictedY, breakObject.x - predictedX);

                        let preBreakAngle = 0, preBreakCone = 0;
                        let hasBreakObj = false;

                        if (distToBreakSq <= (weaponRange + breakScale)**2) {
                            preBreakAngle = baseAngle;
                            preBreakCone = Math.atan2(breakScale || 20, Math.max(Math.sqrt(distToBreakSq), 1));
                            hasBreakObj = true;
                        } else {
                            // FIX: Fallback to current position if predicted position is out of range
                            const currentDistSq = (myX - breakObject.x)**2 + (myY - breakObject.y)**2;
                            if (currentDistSq <= (weaponRange + breakScale)**2) {
                                preBreakAngle = Math.atan2(breakObject.y - myY, breakObject.x - myX);
                                preBreakCone = Math.atan2(breakScale || 20, Math.max(Math.sqrt(currentDistSq), 1));
                                hasBreakObj = true;
                            }
                        }

                        let preEnemyAngle = 0, preEnemyCone = 0;
                        let hasEnemy = false;
                        if (nearestEnemy && !enemyTrapped) {
                            const eScale = nearestEnemy.scale || 0;
                            const eDistSq = (predictedX - nearestEnemy.x2)**2 + (predictedY - nearestEnemy.y2)**2;
                            if (eDistSq <= (weaponRange + eScale)**2) {
                                preEnemyAngle = Math.atan2(nearestEnemy.y2 - predictedY, nearestEnemy.x2 - predictedX);
                                preEnemyCone = Math.atan2(eScale || 20, Math.max(Math.sqrt(eDistSq), 1));
                                hasEnemy = true;
                            }
                        }

                        let hitCount = 0;
                        let nonHitCount = 0;
                        const hitAngles = window.vars._hitAngles;
                        const hitCones = window.vars._hitCones;
                        const nonHitAngles = window.vars._nonHitAngles;
                        const nonHitCones = window.vars._nonHitCones;

                        for (let i = 0; i < visibleObjects.length; i++) {
                            const obj = visibleObjects[i];
                            let isHittable = false;
                            let isNonHittable = false;

                            if (isPathBreaking) {
                                if ((isObjectMine(obj) && (obj.id === 15 || (obj.id > 5 && obj.id < 10))) || (!isObjectMine(obj) && nearestEnemy)) {
                                    isHittable = true;
                                } else if (isObjectMine(obj) && obj.id !== 15 && !(obj.id > 5 && obj.id < 10)) {
                                    isNonHittable = true;
                                }
                            } else {
                                if (obj !== enemyTrapped && obj.id >= 0 && obj.id < 25 && !isObjectOur(obj)) {
                                    isHittable = true;
                                } else if (obj.id >= 0 && obj.id < 25 && (isObjectOur(obj) || obj === enemyTrapped)) {
                                    isNonHittable = true;
                                }
                            }

                            if ((isHittable && obj !== breakObject) || isNonHittable) {
                                const oScale = obj.scale || 0;
                                const distSq = (predictedX - obj.x)**2 + (predictedY - obj.y)**2;
                                if (distSq <= (weaponRange + oScale)**2) {
                                    const angle = Math.atan2(obj.y - predictedY, obj.x - predictedX);
                                    const cone = Math.atan2(oScale || 20, Math.max(Math.sqrt(distSq), 1));

                                    if (isHittable && obj !== breakObject && hitCount < 100) {
                                        hitAngles[hitCount] = angle;
                                        hitCones[hitCount] = cone;
                                        hitCount++;
                                    } else if (isNonHittable && nonHitCount < 100) {
                                        nonHitAngles[nonHitCount] = angle;
                                        nonHitCones[nonHitCount] = cone;
                                        nonHitCount++;
                                    }
                                }
                            }
                        }

                        const nonHittablePenalty = isPathBreaking ? 50 : (isTrapped ? 100 : 500);
                        const PI2 = Math.PI * 2;

                        const scoreAngle = (angle) => {
                            if (!hasBreakObj) return -Infinity;

                            let diff = Math.abs(preBreakAngle - angle);
                            if (diff > Math.PI) diff = PI2 - diff;
                            if (diff > preBreakCone) return -Infinity;

                            let score = 10000;

                            if (hasEnemy) {
                                let ediff = Math.abs(preEnemyAngle - angle);
                                if (ediff > Math.PI) ediff = PI2 - ediff;
                                if (ediff <= preEnemyCone) score += 1000;
                            }

                            for (let i = 0; i < hitCount; i++) {
                                let hdiff = Math.abs(hitAngles[i] - angle);
                                if (hdiff > Math.PI) hdiff = PI2 - hdiff;
                                if (hdiff <= hitCones[i]) score += 100;
                            }

                            for (let i = 0; i < nonHitCount; i++) {
                                let nhdiff = Math.abs(nonHitAngles[i] - angle);
                                if (nhdiff > Math.PI) nhdiff = PI2 - nhdiff;
                                if (nhdiff <= nonHitCones[i]) score -= nonHittablePenalty;
                            }

                            return score;
                        };

                        // Algorithmic Optimization: Coarse + Fine Search (92 evaluations instead of 360)
                        let bestAngle = baseAngle;
                        let bestScore = scoreAngle(baseAngle);

                        // Coarse Pass (72 steps, 5 degrees)
                        const coarseSteps = 72;
                        const coarseStep = PI2 / coarseSteps;
                        for (let i = 0; i < coarseSteps; i++) {
                            const angle = i * coarseStep;
                            const score = scoreAngle(angle);
                            if (score > bestScore) {
                                bestScore = score;
                                bestAngle = angle;
                            }
                        }

                        // Fine Pass (20 steps, 1 degree around the best coarse angle)
                        const fineStep = Math.PI / 180;
                        for (let i = -10; i <= 10; i++) {
                            if (i === 0) continue;
                            const angle = bestAngle + (i * fineStep);
                            const normAngle = (angle + PI2) % PI2;
                            const score = scoreAngle(normAngle);
                            if (score > bestScore) {
                                bestScore = score;
                                bestAngle = normAngle;
                            }
                        }

                        if (bestScore === -Infinity) {
                            window.vars._breakStuckTicks++;
                            if (window.vars._breakStuckTicks >= 5) {
                                autoBreak = false;
                                autoReload = true;
                                breakObject = null;
                                window.vars._breakStuckTicks = 0;
                            }
                        } else {
                            window.vars._breakStuckTicks = 0;
                            window.vars._lastBreakAngle = bestAngle;
                            autoBreakAngle = bestAngle;
                        }
                    }
                } else {
                    if (autoBreak) {
                        autoReload = true;
                        autoBreak = false;
                    }
                }

                if (soldierAnti) {
                    soldierAnti = false;
                }

                if (hits.length > 0) {
                    for (let i = 0; i < hits.length; i++) {
                        let hit = hits[i];
                        let player = hit.player;
                        let weapon = hit.weapon;

                        if (weapon < 9) {
                            primaryReload[player.sid] = (player.skinIndex == 20 && items.weapons[weapon].speed > 300) ? 0.22 : 0;
                        } else {
                            secondaryReload[player.sid] = (player.skinIndex == 20) ? 0.22 : 0;
                        }

                        if (player.sid == myPlayer.sid) {
                            if (checkGather) {
                                if (!autogathering) autogathering = true;
                                checkGather = false;
                            }
                        } else if (!isAlly(player.sid)) {
                            distributionDamages({ type: "hit", weapon: weapon, player: player });
                        }
                    }
                    hits.length = 0; // Zero allocation clear
                }

                if (shoots.length > 0) {
                    for (let i = 0; i < shoots.length; i++) {
                        let shoot = shoots[i];
                        let projectile = shoot.projectile;

                        projectile.player = null;
                        projectile.object = null;

                        if (projectile.speed == 1.5) {
                            projectile.weapon = "turret";

                            let minDistSq = 35 * 35;
                            let closestPlayer = null;
                            for (let j = 0; j < players.length; j++) {
                                let p = players[j];
                                if (p.visible) {
                                    let distSq = (p.x2 - projectile.x)**2 + (p.y2 - projectile.y)**2;
                                    if (distSq < minDistSq) {
                                        minDistSq = distSq;
                                        closestPlayer = p;
                                    }
                                }
                            }

                            if (closestPlayer != null) {
                                projectile.player = closestPlayer;
                                projectileHandle(projectile);
                                turretReload[closestPlayer.sid] = 0;
                            } else {
                                let minDistObjSq = 43 * 43;
                                for (let j = 0; j < visibleObjects.length; j++) {
                                    let obj = visibleObjects[j];
                                    let distSq = (obj.x - projectile.x)**2 + (obj.y - projectile.y)**2;
                                    if (distSq < minDistObjSq) {
                                        minDistObjSq = distSq;
                                        projectile.object = obj;
                                    }
                                }
                            }
                        } else {
                            projectile.x2 = shoot.x - Math.cos(projectile.dir) * 70;
                            projectile.y2 = shoot.y - Math.sin(projectile.dir) * 70;

                            for (let key in items.projectiles) {
                                if (items.projectiles[key].range == shoot.range && items.projectiles[key].speed == shoot.speed) {
                                    for (let w = 0; w < items.weapons.length; w++) {
                                        if (items.weapons[w].projectile == key) {
                                            projectile.weapon = items.weapons[w].id;
                                            break;
                                        }
                                    }
                                    break;
                                }
                            }

                            let minDistSq = 200 * 200;
                            let closestPlayer = null;
                            for (let j = 0; j < players.length; j++) {
                                let p = players[j];
                                if (p.visible && p.weapons[1] == projectile.weapon) {
                                    let distSq = (p.x2 - projectile.x2)**2 + (p.y2 - projectile.y2)**2;
                                    if (distSq < minDistSq) {
                                        minDistSq = distSq;
                                        closestPlayer = p;
                                    }
                                }
                            }

                            if (closestPlayer != null) {
                                projectile.player = closestPlayer;
                                secondaryReload[closestPlayer.sid] = (closestPlayer.skinIndex == 20) ? 0.22 : 0;
                            }
                        }
                    }
                    shoots.length = 0; // Zero allocation clear
                }

                if (removeShoots.length > 0) {
                    for (let i = 0; i < removeShoots.length; i++) {
                        let projectile = removeShoots[i];
                        if (projectile.player && projectile.player != myPlayer && !isAlly(projectile.player.sid)) {
                            distributionDamages({ type: "shoot", projectile: projectile });
                        }
                    }
                    removeShoots.length = 0; // Zero allocation clear
                }
                // GET SPIKE DAMAGES
                distributionDamages({ type: "spikes" });
                if (spikeDamages.length > 0) {
                    spikeDmgCount++;

                    for (let i in spikeDamages) {
                        spikeDmg++;
                    }
                } else {
                    spikeDmgCount = 0;
                }



                // PREDICT MOVE
                predictMove = [];
                for (let i in keys) {
                    if (!keys[i]) continue;

                    if (moveVectors[i]) {
                        predictMove.push(moveVectors[i]);
                    }
                }

                predictMoveAngle = null;
                if (predictMove.length > 0) {
                    let moveX = 0;
                    let moveY = 0;

                    for (let vector of predictMove) {
                        moveX += vector[0];
                        moveY += vector[1];
                    }

                    if (moveX != 0 || moveY != 0) {
                        predictMoveAngle = Math.atan2(moveY, moveX);
                    }
                }

                // Reset variables each tick for our movememnt combat
                shouldntPathfind = false;
                pathPosition = null;
                pathMode = {
                    avoidEnemySpikes: false,
                    avoidEnemy: false,
                }

                if(pathBreak) {
                    let objects = visibleObjects.filter(object => (object.id == 15 || (object.id > 5 && object.id < 10)) && isObjectMine(object));

                    if (objects.length > 0) {
                        const hammerRange = getPlayerInfo(myPlayer, "secondaryRange");

                        // Find closest object
                        const closestObject = objects.reduce((nearest, obj) => {
                            const dist = UTILS.getDistance(myPlayer.x2, myPlayer.y2, obj.x, obj.y);
                            const nearestDist = UTILS.getDistance(myPlayer.x2, myPlayer.y2, nearest.x, nearest.y);
                            return dist < nearestDist ? obj : nearest;
                        });

                        // Check if there's another object close to it
                        const nearbyObject = objects.find(obj =>
                                                          obj !== closestObject &&
                                                          UTILS.getDistance(closestObject.x, closestObject.y, obj.x, obj.y) <= hammerRange * 2
                                                         );

                        // Move to midpoint if nearby object exists, otherwise position at object.scale distance
                        if (nearbyObject) {
                            pathPosition = {
                                x: (closestObject.x + nearbyObject.x) / 2,
                                y: (closestObject.y + nearbyObject.y) / 2
                            };
                        } else {
                            const angle = Math.atan2(closestObject.y - myPlayer.y2, closestObject.x - myPlayer.x2);
                            pathPosition = {
                                x: closestObject.x - Math.cos(angle) * closestObject.scale,
                                y: closestObject.y - Math.sin(angle) * closestObject.scale
                            };
                        }

                        pathMode = {
                            avoidEnemy: false,
                            avoidEnemySpikes: true,
                        }
                    } else {
                        pathPosition = null;
                    }
                }

                if (nearestEnemy && window.vars.autoPlay) {
                    const circleRadius = 80;
                    const rotationSpeed = 0.2;

                    // Store rotation direction if not set
                    if (!window.vars.circleDirection) {
                        window.vars.circleDirection = 1; // 1 = counterclockwise, -1 = clockwise
                    }

                    const currentAngle = Math.atan2(
                        myPlayer.yVel - nearestEnemy.yVel,
                        myPlayer.xVel - nearestEnemy.xVel
                    );

                    // Try current direction
                    let nextAngle = currentAngle + (rotationSpeed * window.vars.circleDirection);
                    let targetPos = {
                        x: nearestEnemy.xVel + Math.cos(nextAngle) * circleRadius,
                        y: nearestEnemy.yVel + Math.sin(nextAngle) * circleRadius
                    };

                    pathMode = {
                        avoidEnemySpikes: false,
                        avoidEnemy: true,
                    }
                    // Check if target position is blocked
                    if (isPositionBlocked(targetPos, pathMode)) {
                        window.vars.circleDirection *= -1;
                        nextAngle = currentAngle + (rotationSpeed * window.vars.circleDirection);
                        targetPos = {
                            x: nearestEnemy.xVel + Math.cos(nextAngle) * circleRadius,
                            y: nearestEnemy.yVel + Math.sin(nextAngle) * circleRadius
                        };
                    }

                    pathPosition = targetPos;

                    pathMode = {
                        avoidEnemySpikes: false,
                        avoidEnemy: true,
                    }
                }
                // AUTO PUSH
                autoPush = false;
                autoPushAngle = null;
                if (nearestEnemy && !nearestTrap && window.vars.autoPush) {
                    let trap = visibleObjects.filter(object => object.id == 15 && UTILS.getDistance(nearestEnemy.x2, nearestEnemy.y2, object.x, object.y) < 50 && (object.owner.sid == myPlayer.sid || isAlly(object.owner.sid)))[0];
                    if (trap) {
                        let spikes = visibleObjects.filter(object => object.id > 5 && object.id < 10 && UTILS.getDistance(trap.x, trap.y, object.x, object.y) < (30 / 2 + object.scale + trap.scale) && (object.owner.sid == myPlayer.sid || isAlly(object.owner.sid)));
                        let nearestSpike = spikes.sort((a, b) => UTILS.getDistance(nearestEnemy.x2, nearestEnemy.y2, a.x, a.y) - UTILS.getDistance(nearestEnemy.x2, nearestEnemy.y2, b.x, b.y))[0];

                        if (nearestSpike && !isSpikeCollisionEnemy(nearestSpike)) {
                            let posX = nearestSpike.x + nearestSpike.scale * Math.cos(Math.atan2(trap.y - nearestSpike.y, trap.x - nearestSpike.x));
                            let posY = nearestSpike.y + nearestSpike.scale * Math.sin(Math.atan2(trap.y - nearestSpike.y, trap.x - nearestSpike.x));

                            pushPositions = {
                                x: posX + (UTILS.getDistance(posX, posY, nearestEnemy.x2, nearestEnemy.y2) + 35) * Math.cos(Math.atan2(nearestEnemy.y2 - posY, nearestEnemy.x2 - posX)),
                                y: posY + (UTILS.getDistance(posX, posY, nearestEnemy.x2, nearestEnemy.y2) + 35) * Math.sin(Math.atan2(nearestEnemy.y2 - posY, nearestEnemy.x2 - posX)),
                                x2: posX,
                                y2: posY
                            };

                            if (canAutoPush()) {
                                shouldntPathfind = true;
                                autoPush = true;
                                autoPushAngle = Math.atan2(pushPositions.y - myPlayer.y2, pushPositions.x - myPlayer.x2);
                            }
                            else {
                                let position =
                                    {
                                        x: posX + (UTILS.getDistance(posX, posY, nearestEnemy.x2, nearestEnemy.y2) + 45) * Math.cos(Math.atan2(nearestEnemy.y2 - posY, nearestEnemy.x2 - posX)),
                                        y: posY + (UTILS.getDistance(posX, posY, nearestEnemy.x2, nearestEnemy.y2) + 45) * Math.sin(Math.atan2(nearestEnemy.y2 - posY, nearestEnemy.x2 - posX)),
                                    }
                                pathPosition = position;

                                pathMode.avoidEnemySpikes = true;
                                pathMode.avoidEnemy = true;
                            }
                        }
                        else if (nearestSpike && isSpikeCollisionEnemy(nearestSpike)) {
                            // Check pos where we could respike enemy
                            let objects = visibleObjects.filter(obj => obj != nearestSpike);
                            let spikes = getPrePlaceAngles(myPlayer.items[2], objects);
                            let canReSpike = false;
                            for (let spike of spikes) {
                                if (UTILS.getDistance(spike.x, spike.y, nearestEnemy.x2, nearestEnemy.y2) < spike.scale + 35) {
                                    canReSpike = true;
                                    predictMoveAngle = null;
                                    shouldntPathfind = true;
                                    break;
                                }
                            }
                        }
                    }
                }
                if (autoPush) {
                    predictMoveAngle = autoPushAngle;
                }

                // PATHFINDER
                path = null;
                if (pathPosition && !shouldntPathfind) {
                    path = pathfindTo(pathPosition, pathMode);

                    if (path && path.length > 0) {
                        const nextWaypoint = path.length > 1 ? path[1] : path[0];
                        predictMoveAngle = Math.atan2(
                            nextWaypoint.y - myPlayer.y2,
                            nextWaypoint.x - myPlayer.x2
                        );

                    }
                }
                healing = false;
                if(myPlayer.alive){

                    // ==================== VELOCITY TICK ====================
                    //
                    // RYN's version, whole, in deltek's own terms. The combo is
                    // two server ticks, not two setTimeouts:
                    //
                    //   ARM   turret gear on, walk at them. The turret shot goes
                    //         out this tick and the walk closes the gap while it
                    //         travels.
                    //   FIRE  next tick, bull on and swing the polearm while the
                    //         knockback still has them moving.
                    //
                    // deltek's old toptop() fired both halves off setTimeout(93)
                    // and setTimeout(210) — wall clock, so it drifts against the
                    // server tick and against ping. Ticks are what the server
                    // counts, so ticks are what this counts.
                    //
                    // The trap branch is deliberately not here.

                    // Soldier eats the damage the combo is for; hat 22 eats the
                    // knockback the whole window depends on. Either one makes the
                    // shot worthless, so neither is worth spending it on.
                    function velocityValidHat(skinIndex) {
                        return skinIndex !== null && skinIndex !== undefined &&
                            skinIndex !== 6 && skinIndex !== 22;
                    }

                    // 220-245 is not a range check. It is where the turret's
                    // knockback leaves them once the shot lands, which is why the
                    // window has a floor as well as a ceiling: nearer and the
                    // polearm already reaches without the combo, further and the
                    // knockback cannot bring them into it.
                    const VELOCITY_MIN_KB = 220;
                    const VELOCITY_MAX_KB = 245;

                    if (window.vars.velocityTick && myPlayer && myPlayer.alive) {
                        // ── FIRE ────────────────────────────────────────────
                        // Armed last tick, so the turret has gone out and the
                        // walk has had a tick to close the gap. Aim at where they
                        // are now, not where they were when we armed.
                        if (velocityTarget !== null) {
                            const fireAngle = Math.atan2(
                                velocityTarget.y2 - myPlayer.y2,
                                velocityTarget.x2 - myPlayer.x2
                            );

                            hat(7, 0);
                            keyCodeWeapon = myPlayer.weapons[0];
                            selectWeapon(keyCodeWeapon);
                            autoaim = true;
                            autoaimAngle = fireAngle;
                            predictMoveAngle = fireAngle;
                            shouldntPathfind = true;
                            io.send("F", fireAngle);

                            velocityTarget = null;
                        } else if (nearestEnemy) {
                            // ── ARM ─────────────────────────────────────────
                            // Every gate RYN checks, asked of deltek's own state.
                            const isPolearm = myPlayer.weapons[0] === 5;
                            // Diamond or ruby. Below that the polearm does not hit
                            // hard enough for the combo to be worth the turret.
                            const isDiamond = getPlayerInfo(myPlayer, "primaryVariant") >= 2;
                            const primaryReady = primaryReload[myPlayer.sid] >= 1;
                            const turretReady = turretReload[myPlayer.sid] >= 1;

                            if (isPolearm && isDiamond && primaryReady && turretReady) {
                                // Against where they will be, not where they are:
                                // deltek's xVel/yVel is already next tick's
                                // position (x2 * 2 - lastX), which is the same
                                // extrapolation RYN reads off pos.future.
                                const futureX = nearestEnemy.xVel;
                                const futureY = nearestEnemy.yVel;
                                const dist = UTILS.getDistance(
                                    myPlayer.x2, myPlayer.y2, futureX, futureY
                                );
                                const armAngle = Math.atan2(
                                    futureY - myPlayer.y2, futureX - myPlayer.x2
                                );

                                // Worth spending the turret on: either their melee
                                // comes up within the tick — so the shot lands as
                                // they commit — or they are wearing a hat the
                                // knockback still works on.
                                const enemyWeapon = items.weapons[nearestEnemy.weapons[0]];
                                const enemyReload = primaryReload[nearestEnemy.sid] || 0;
                                const almostReloaded = !!enemyWeapon &&
                                    enemyReload + (game.tickRate / enemyWeapon.speed) >= 1;
                                // RYN reads the enemy's *next* hat here. deltek
                                // keeps no hat prediction, so this is the hat they
                                // are wearing now — the same question, one tick
                                // less notice.
                                const goodHat = velocityValidHat(nearestEnemy.skinIndex);

                                if (dist >= VELOCITY_MIN_KB && dist <= VELOCITY_MAX_KB &&
                                    (almostReloaded || goodHat)) {
                                    hat(53, 0);
                                    keyCodeWeapon = myPlayer.weapons[0];
                                    selectWeapon(keyCodeWeapon);
                                    // Walk into them while the shot travels. This
                                    // is the half deltek's old version left out,
                                    // and it is what makes the window close.
                                    predictMoveAngle = armAngle;
                                    shouldntPathfind = true;
                                    velocityTarget = nearestEnemy;
                                }
                            }
                        }
                    } else if (velocityTarget !== null) {
                        // Toggled off, or died, with the combo half-fired. Drop it
                        // rather than leaving a stale target to fire on later.
                        velocityTarget = null;
                    }
                    // PREDICT WEAPON
                    predictWeapon = getPredictWeapon();

                    antiReverse = [];
                    antiInsta = [];

                    // SAFEWALK
                    if (!imTrapped) {
                        const lookahead = 222;
                        const futureX = myPlayer.x2 + Math.cos(predictMoveAngle) * lookahead;
                        const futureY = myPlayer.y2 + Math.sin(predictMoveAngle) * lookahead;
                        const startX = myPlayer.x2 + Math.cos(predictMoveAngle) * 35;
                        const startY = myPlayer.y2 + Math.sin(predictMoveAngle) * 35;

                        // Smooth angle interpolation
                        const lerpAngle = (from, to, t) => {
                            let diff = to - from;
                            while (diff > Math.PI) diff -= Math.PI * 2;
                            while (diff < -Math.PI) diff += Math.PI * 2;
                            return from + diff * t;
                        };

                        // Find best safe angle
                        const findBestAngle = () => {
                            const angleSteps = 24; // More steps for accuracy
                            let bestAngle = predictMoveAngle;
                            let bestScore = -Infinity;

                            for (let i = 0; i < angleSteps; i++) {
                                const testAngle = (Math.PI * 2 / angleSteps) * i;
                                const testFutureX = myPlayer.x2 + Math.cos(testAngle) * lookahead;
                                const testFutureY = myPlayer.y2 + Math.sin(testAngle) * lookahead;
                                const testStartX = myPlayer.x2 + Math.cos(testAngle) * 35;
                                const testStartY = myPlayer.y2 + Math.sin(testAngle) * 35;

                                let score = 100;
                                let pathBlocked = false;
                                let minDist = Infinity;

                                const allObstacles = [
                                    ...spikes_enemy.map(s => ({ x: s.x, y: s.y, scale: myPlayer.scale + s.scale })),
                                    ...cactuses.map(c => ({ x: c.x, y: c.y, scale: c.scale }))
                                ];

                                for (let obs of allObstacles) {
                                    const dist = UTILS.getDistance(obs.x, obs.y, testFutureX, testFutureY);
                                    const intersects = UTILS.lineInRect(
                                        obs.x - obs.scale, obs.y - obs.scale,
                                        obs.x + obs.scale, obs.y + obs.scale,
                                        testStartX, testStartY, testFutureX, testFutureY
                                    );

                                    if (intersects || dist < obs.scale) {
                                        pathBlocked = true;
                                        break;
                                    }

                                    minDist = Math.min(minDist, dist);
                                }

                                if (pathBlocked) continue;

                                // Higher weight for distance = smoother paths
                                score += Math.min(minDist, 300) * 2.0;

                                // Strong preference for staying close to intended direction
                                let angleDiff = Math.abs(testAngle - predictMoveAngle);
                                if (angleDiff > Math.PI) angleDiff = Math.PI * 2 - angleDiff;
                                score += (Math.PI - angleDiff) * 120;

                                if (score > bestScore) {
                                    bestScore = score;
                                    bestAngle = testAngle;
                                }
                            }

                            // Smooth blend to best angle instead of instant switch
                            return bestScore > 0 ? lerpAngle(predictMoveAngle, bestAngle, 0.5) : predictMoveAngle;
                        };

                        // Check obstacle
                        const checkObstacle = (obs, collisionDist, stopDist) => {
                            const dist = UTILS.getDistance(obs.x, obs.y, myPlayer.xVel, myPlayer.yVel);

                            const pathIntersects = UTILS.lineInRect(
                                obs.x - collisionDist, obs.y - collisionDist,
                                obs.x + collisionDist, obs.y + collisionDist,
                                startX, startY, futureX, futureY
                            );

                            if (!pathIntersects) return false;

                            const closeIntersects = UTILS.lineInRect(
                                obs.x - 60, obs.y - 60,
                                obs.x + 60, obs.y + 60,
                                startX, startY, futureX, futureY
                            );

                            if (closeIntersects) {
                                if (dist <= collisionDist) {
                                    // Smooth escape
                                    const awayAngle = Math.atan2(myPlayer.y2 - obs.y, myPlayer.x2 - obs.x);
                                    predictMoveAngle = lerpAngle(predictMoveAngle, awayAngle, 0.7);
                                    return true;
                                }
                                else if (dist <= stopDist) {
                                    predictMoveAngle = null;
                                    return true;
                                }
                            }
                            else if (dist <= stopDist) {
                                predictMoveAngle = findBestAngle();
                                return true;
                            }

                            return false;
                        };

                        // Process spikes
                        for (let spike of spikes_enemy) {
                            const collisionDist = myPlayer.scale + spike.scale + 1;
                            const stopDist = spike.scale + 75;
                            if (checkObstacle(spike, collisionDist, stopDist)) break;
                        }

                        // Process cactuses
                        if (predictMoveAngle !== null) {
                            for (let cactus of cactuses) {
                                const collisionDist = cactus.scale + 1;
                                const stopDist = cactus.scale + 35;
                                if (checkObstacle(cactus, collisionDist, stopDist)) break;
                            }
                        }
                    }
                    if (predictMoveAngle != lastMoveAngle) {
                        io.send("9", predictMoveAngle);
                        lastMoveAngle = predictMoveAngle;
                    }

                    if (nearestEnemy && settings.x18ksync && primaryReload[myPlayer.sid] == 1 && !autoaim) {
                        let myPlayerDamage = 0;
                        if (UTILS.getDistance(myPlayer.xVel, myPlayer.yVel, nearestEnemy.xVel, nearestEnemy.yVel) <= (35 * 1.8 + items.weapons[myPlayer.weapons[0]].range)) {
                            myPlayerDamage += items.weapons[myPlayer.weapons[0]].dmg * 1.5 * config.weaponVariants[myPlayer.weaponVariants[myPlayer.weapons[0]]].val;
                        }

                        for (let player of players.filter((player) => player.sid != myPlayer.sid && isAlly(player.sid))) {
                            const nearestEnemyAlly = enemiesNear.sort((a, b) => UTILS.getDistance(player.x2, player.y2, a.x2, a.y2) - UTILS.getDistance(player.x2, player.y2, b.x2, b.y2))[0];
                            if (nearestEnemy.sid != nearestEnemyAlly.sid) continue;

                            let allyDamage = 0;
                            if (UTILS.getDistance(player.xVel, player.yVel, nearestEnemy.xVel, nearestEnemy.yVel) <= (35 * 1.8 + items.weapons[player.weapons[0]].range)
                                && primaryReload[player.sid] == 1) {
                                allyDamage += items.weapons[player.weapons[0]].dmg * 1.5 * config.weaponVariants[player.weaponVariants[player.weapons[0]]].val;
                            }

                            if (((myPlayerDamage + allyDamage) * .75) > 100) {
                                instaKill = ["primary", "stop"];
                                break;
                            }
                        }
                    }

                    if(advancedShameCombat()) {
                        autoBreak = false;
                    }

                    if (doSmartTickAnti()) {
                        instaKill = ["primaryturret", "stop"];
                    }

                    if (canSmartTick() || canShamePlus()) {
                        instaKill = ["secondary", "stop"];
                    }

                    if (canAutoShame()) {
                        instaKill = ["primary", "stop"];
                    }

                    if (canTrapTick()) {
                        instaKill = ["secondary", "primary", "turret", "stop"];
                    }

                    if (canVelocitySpikeTick()) {
                        instaKill = ["primary", "stop"];
                    }





                    // INTSA KILL FUNCTION
                    if (instaKill.length > 0) {
                        if (instaKill[0] == "secondary") {
                            if (smartTickObject)
                                autoaimAngle = Math.atan2(smartTickObject.y - myPlayer.yVel, smartTickObject.x - myPlayer.xVel);
                            else if (nearestEnemy) autoaimAngle = Math.atan2(nearestEnemy.y2 - myPlayer.yVel, nearestEnemy.x2 - myPlayer.xVel);
                            autoaim = true;

                            insta.primary = false;
                            insta.secondary = true;

                            predictWeapon = myPlayer.weapons[1];

                            if (!isBadTail()) {
                                instaKill.shift();
                            }
                        } else if (instaKill[0] == "primary") {
                            if (nearestEnemy)
                                autoaimAngle = Math.atan2(nearestEnemy.yVel - myPlayer.yVel, nearestEnemy.xVel - myPlayer.xVel);
                            autoaim = true;

                            insta.primary = true;
                            insta.secondary = false;

                            predictWeapon = myPlayer.weapons[0];

                            if (!isBadTail()) {
                                instaKill.shift();
                            }
                        }
                        else if (instaKill[0] == "turret") {
                            insta.primary = false;
                            insta.secondary = false;
                            insta.turret = true;
                            autoaim = false;
                            instaKill.shift();
                        }
                        else if (instaKill[0] == "primaryturret") {
                            if (nearestEnemy)
                                autoaimAngle = Math.atan2(nearestEnemy.yVel - myPlayer.yVel, nearestEnemy.xVel - myPlayer.xVel);
                            autoaim = true;
                            predictWeapon = myPlayer.weapons[0];

                            insta.primary = false;
                            insta.secondary = false;
                            insta.turret = false;
                            insta.primaryturret = true;

                            instaKill.shift();
                        }
                        else if (instaKill[0] == "stop") {
                            insta.primary = false;
                            insta.secondary = false;
                            insta.turret = false;
                            insta.primaryturret = false;

                            autoaim = false;

                            autoReload = true;
                            instaKill.shift();
                        }
                    }

                    antiPush = isNearestEnemyPushPlayer();
                    if (antiPush) {
                        predictWeapon = myPlayer.weapons[0];
                    }

                    // AUTOBUY
                    if(window.vars.autoBuy) {
                        for (const item of autoBuyList) {
                            if (!isBoughtHat(item.id, item.type)) {
                                if (myPlayer.points >= item.cost) {
                                    storeBuy(item.id, item.type);
                                }
                                break;
                            }
                        }
                    }

                    // AUTOGRIND
                    grindAngle = null;
                    gatherGrind = false;
                    grindObjects = [];
                    if (gPressed && myPlayer && (!nearestEnemy || UTILS.getDistance(nearestEnemy.x2, nearestEnemy.y2, myPlayer.x2, myPlayer.y2) > 300) && myPlayer.items[5] == 17) {
                        if ((getPlayerInfo(myPlayer, "primaryVariant") < 2 || getPlayerInfo(myPlayer, "secondaryVariant") < 1) && getPlayerInfo(myPlayer, "secondaryWeapon") == "hammer") {
                            let candidateTurrets = turrets_our.filter(object => UTILS.getDistance(object.x, object.y, myPlayer.x2, myPlayer.y2) <= getPlayerInfo(myPlayer, "secondaryRange") + object.scale);
                            if (candidateTurrets.length > 0) {
                                gatherGrind = true;
                                const hammerDmg = getPlayerInfo(myPlayer, "secondaryStructureDmg");
                                const weaponGatherAngle = Math.PI / 2.6;
                                const allOneshotByHammer = candidateTurrets.every(turret => turret.health <= hammerDmg);
                                const findOptimalAngle = (turrets) => {
                                    if (turrets.length === 0) return 0;
                                    let sumX = 0, sumY = 0;
                                    for (let turret of turrets) {
                                        let angle = Math.atan2(turret.y - myPlayer.y2, turret.x - myPlayer.x2);
                                        sumX += Math.cos(angle);
                                        sumY += Math.sin(angle);
                                    }
                                    let centerAngle = Math.atan2(sumY, sumX);
                                    let hitsFromCenter = turrets.filter(t => {
                                        let turretAngle = Math.atan2(t.y - myPlayer.y2, t.x - myPlayer.x2);
                                        let angleDiff = Math.abs(((turretAngle - centerAngle + Math.PI) % (2 * Math.PI)) - Math.PI);
                                        return angleDiff <= weaponGatherAngle;
                                    }).length;
                                    let bestAngle = centerAngle;
                                    let maxHits = hitsFromCenter;
                                    for (let turret of turrets) {
                                        let angle = Math.atan2(turret.y - myPlayer.y2, turret.x - myPlayer.x2);
                                        let hits = turrets.filter(t => {
                                            let turretAngle = Math.atan2(t.y - myPlayer.y2, t.x - myPlayer.x2);
                                            let angleDiff = Math.abs(((turretAngle - angle + Math.PI) % (2 * Math.PI)) - Math.PI);
                                            return angleDiff <= weaponGatherAngle;
                                        }).length;
                                        if (hits > maxHits) {
                                            maxHits = hits;
                                            bestAngle = angle;
                                        }
                                    }
                                    return bestAngle;
                                };
                                if (allOneshotByHammer && getPlayerInfo(myPlayer, "primaryVariant") < 2) {
                                    predictWeapon = myPlayer.weapons[0];
                                    grindAngle = findOptimalAngle(candidateTurrets);
                                }
                                else if (getPlayerInfo(myPlayer, "primaryVariant") < 2) {
                                    predictWeapon = myPlayer.weapons[1];
                                    let validTurrets = candidateTurrets.filter(turret => turret.health > hammerDmg);

                                    if (validTurrets.length > 0) {
                                        grindAngle = findOptimalAngle(validTurrets);
                                    }
                                }
                                else {
                                    predictWeapon = myPlayer.weapons[1];
                                    grindAngle = findOptimalAngle(candidateTurrets);
                                }
                            }
                            else {
                                for (let i = 0; i < 36; i++) {
                                    const angle = UTILS.toRad(i * (360 / 36));
                                    if (canPlace(myPlayer.items[5], angle) &&
                                        canPlace(myPlayer.items[5], angle - UTILS.toRad(73)) &&
                                        canPlace(myPlayer.items[5], angle + UTILS.toRad(73))) {
                                        grindObjects.push({
                                            id: myPlayer.items[5],
                                            angle: angle,
                                            preplace: false
                                        });
                                        grindObjects.push({
                                            id: myPlayer.items[5],
                                            angle: angle - UTILS.toRad(73),
                                            preplace: false
                                        });
                                        grindObjects.push({
                                            id: myPlayer.items[5],
                                            angle: angle + UTILS.toRad(73),
                                            preplace: false
                                        });
                                        break;
                                    }
                                }
                            }
                        }
                        else {
                            gPressed = false;
                        }
                    }

                    // KILL CHAT
                    if(myPlayer && myPlayer.kills > prevKills && window.vars.killChat) {
                        showKillMessage();
                        sendChat(window.vars.chatMsg || "No killchat msg");
                    }
                    prevKills = myPlayer.kills;


                    // ANTIS AND HEAL

                    // SPIKE DMG PREDICTIONS
                    let spikeDmgPot = 0;
                    let secDmgPot = 0;
                    let poisonDmgPot = 0;

                    // DAMAGE BY POISON
                    for (let damage of damages) {
                        if (damage == 5 || damage == (5 * .75)) {
                            damageByPoisonTick = tick;
                        }
                    }

                    // PREDICT POISON DAMAGE
                    if ((tick - damageByPoisonTick) % 9 == 8 || (tick - damageByPoisonTick) % 9 == 9) {
                        poisonDmgPot = 5;
                    }

                    // COLLISION WHILE TRAPPED
                    let collidingspike = false;
                    if (imTrapped) {
                        if (spikeDamages.length > 0) {
                            for (let spike of spikes_enemy) {
                                if (UTILS.getDistance(myPlayer.x2, myPlayer.y2, spike.x, spike.y) <= spike.scale + myPlayer.scale + 10) {
                                    collidingspike = true;
                                    break;
                                }
                            }
                        }
                    }

                    if (collidingspike && spikeDamages.length > 0) {
                        for (let dmg of spikeDamages) {
                            // Check if this damage value has the 0.75 multiplier
                            if (dmg == (20 * 0.75) || dmg == (30 * 0.75) || dmg == (35 * 0.75) || dmg == (45 * 0.75)) {
                                spikeDmgPot += dmg / 0.75; // Reverse the multiplier
                            } else {
                                spikeDmgPot += dmg; // Add normally
                            }
                        }
                    }

                    // KNOCKBACKS PREDICTIONS
                    let willcollide = false;
                    if (!(imTrapped && collidingspike)) {
                        // Calculate distance between current and last pos
                        let distanceX = lastPosX - myPlayer.x2;
                        let distanceY = lastPosY - myPlayer.y2;
                        let distance = Math.sqrt(distanceX * distanceX + distanceY * distanceY);

                        // Only predict if movement distance is significant
                        if (distance > 2 || damagesByHits.length > 0 || damagesByShoots.length > 0 || damagesByTurrets.length > 0 || spikeDamages.length > 0) {
                            for (let spike of spikes_enemy) {
                                // Circle-line collision detection

                                if (UTILS.lineInRect(spike.x - (myPlayer.scale + spike.scale), spike.y - (myPlayer.scale + spike.scale),
                                                     spike.x + (myPlayer.scale + spike.scale), spike.y + (myPlayer.scale + spike.scale),
                                                     myPlayer.x2, myPlayer.y2,
                                                     myPlayer.xVel, myPlayer.yVel
                                                    )) {
                                    willcollide = true;
                                    spikeDmgPot += spike.dmg;
                                }
                            }

                            for (let cactus of cactuses) {
                                // Circle-line collision detection for cacti
                                if (UTILS.lineInRect(cactus.x - (myPlayer.scale + cactus.scale), cactus.y - (myPlayer.scale + cactus.scale),
                                                     cactus.x + (myPlayer.scale + cactus.scale), cactus.y + (myPlayer.scale + cactus.scale),
                                                     myPlayer.x2, myPlayer.y2,
                                                     myPlayer.xVel, myPlayer.yVel
                                                    )) {
                                    willcollide = true;
                                    spikeDmgPot += 35;
                                }
                            }
                        }
                    }

                    lastPosX = myPlayer.x2;
                    lastPosY = myPlayer.y2;



                    // PREDICTION FOR ALL ENEMIES
                    let hitDmgPot = 0;
                    let turretDmgPot = 0;
                    let predicted = false;

                    for (let enemy of enemiesNear) {
                        let inPrimaryRange = UTILS.getDistance(myPlayer.x2, myPlayer.y2, enemy.x2, enemy.y2) <= myPlayer.scale * 1.8 + getPlayerInfo(enemy, "primaryRange");

                        // PREDICT HIT
                        if (primaryReload[enemy.sid] == 1 && inPrimaryRange) {
                            // When colliding
                            if (collidingspike) {
                                // If we werent colliding just predict
                                if (!lastcolliding) {
                                    hitDmgPot += getPlayerInfo(enemy, "primaryDmg");
                                }
                                // If we were colliding predict if enemy last reload wasnt 1
                                else if (enemy.lastPrimaryReload < 1) {
                                    hitDmgPot += getPlayerInfo(enemy, "primaryDmg");
                                }
                                else if (secondaryReload[myPlayer.sid] == 1 && !lastPredicted) {
                                    predicted = true;
                                    hitDmgPot += getPlayerInfo(enemy, "primaryDmg");
                                }
                            }
                            // When we will collide
                            else if (willcollide) {
                                hitDmgPot += getPlayerInfo(enemy, "primaryDmg");
                            }
                            // Autosteal predict
                            else if (myPlayer.health <= getPlayerInfo(enemy, "primaryDmg")) {
                                hitDmgPot += getPlayerInfo(enemy, "primaryDmg");
                            }

                        }

                        // PREDICT TURRET HIT
                        if (UTILS.getDistance(enemy.x2, enemy.y2, myPlayer.x2, myPlayer.y2) <= 350 && turretReload[enemy.sid] == 1) {
                            // When colliding spike
                            if (collidingspike && enemy.lastPrimaryReload == 1 && primaryReload[enemy.sid] < 1) {
                                turretDmgPot += 25;
                            }
                            // When we will be knockbacked into spike
                            else if (willcollide && primaryReload[enemy.sid] < 1) {
                                turretDmgPot += 25;
                            }
                            // Prediction for autosteal turret
                            else if (myPlayer.health <= 25 && (hitDmgPot + turretDmgPot + spikeDmgPot) < 25) {
                                turretDmgPot += 25;
                            }
                        }

                        // VELOCITY TICK ANTI
                        if (UTILS.getDistance(enemy.xVel, enemy.yVel, myPlayer.xVel, myPlayer.yVel) > 150 && UTILS.getDistance(enemy.xVel, enemy.yVel, myPlayer.xVel, myPlayer.yVel) < 350) {
                            if (turretReload[enemy.sid] < 1 && primaryReload[enemy.sid] == 1 && enemy.skinIndex == 53) {
                                turretDmgPot += 25;
                                hitDmgPot += getPlayerInfo(enemy, "primaryDmg");
                            }
                        }

                        // KNOCKBACK ANTI
                        canStillGather = false;
                        if (!imTrapped && primaryReload[enemy.sid] == 1 && inPrimaryRange) {
                            let posX = myPlayer.xVel + 111 * (.3 + getPlayerInfo(enemy, "primaryKnockback")) * Math.cos(Math.atan2(myPlayer.yVel - enemy.yVel, myPlayer.xVel - enemy.xVel));
                            let posY = myPlayer.yVel + 111 * (.3 + getPlayerInfo(enemy, "primaryKnockback")) * Math.sin(Math.atan2(myPlayer.yVel - enemy.yVel, myPlayer.xVel - enemy.xVel));

                            for (let spike of spikes_enemy) {
                                if (UTILS.lineInRect(
                                    spike.x - (myPlayer.scale + spike.scale), spike.y - (myPlayer.scale + spike.scale),
                                    spike.x + (myPlayer.scale + spike.scale), spike.y + (myPlayer.scale + spike.scale),
                                    myPlayer.xVel, myPlayer.yVel,
                                    posX, posY
                                )) {
                                    spikeDmgPot += spike.dmg;
                                    hitDmgPot += getPlayerInfo(enemy, "primaryDmg");
                                    canStillGather = true;
                                    break;
                                }
                            }

                            for (let cactus of cactuses) {
                                if (UTILS.lineInRect(
                                    cactus.x - cactus.scale, cactus.y - cactus.scale,
                                    cactus.x + cactus.scale, cactus.y + cactus.scale,
                                    myPlayer.xVel, myPlayer.yVel,
                                    posX, posY
                                )) {
                                    spikeDmgPot += 35;
                                    hitDmgPot += getPlayerInfo(enemy, "primaryDmg");
                                    canStillGather = true;
                                    break;
                                }
                            }
                        }
                        if (!imTrapped && primaryReload[enemy.sid] == 1 && inPrimaryRange) {
                            let posX = myPlayer.x2 + 111 * (.3 + getPlayerInfo(enemy, "primaryKnockback")) * Math.cos(Math.atan2(myPlayer.y2 - enemy.y2, myPlayer.x2 - enemy.x2));
                            let posY = myPlayer.y2 + 111 * (.3 + getPlayerInfo(enemy, "primaryKnockback")) * Math.sin(Math.atan2(myPlayer.y2 - enemy.y2, myPlayer.x2 - enemy.x2));

                            for (let spike of spikes_enemy) {
                                if (UTILS.lineInRect(
                                    spike.x - (myPlayer.scale + spike.scale), spike.y - (myPlayer.scale + spike.scale),
                                    spike.x + (myPlayer.scale + spike.scale), spike.y + (myPlayer.scale + spike.scale),
                                    myPlayer.x2, myPlayer.y2,
                                    posX, posY
                                )) {
                                    spikeDmgPot += spike.dmg;
                                    hitDmgPot += getPlayerInfo(enemy, "primaryDmg");
                                    canStillGather = true;
                                    break;
                                }
                            }

                            for (let cactus of cactuses) {
                                if (UTILS.lineInRect(
                                    cactus.x - cactus.scale, cactus.y - cactus.scale,
                                    cactus.x + cactus.scale, cactus.y + cactus.scale,
                                    myPlayer.x2, myPlayer.y2,
                                    posX, posY
                                )) {
                                    spikeDmgPot += 35;
                                    hitDmgPot += getPlayerInfo(enemy, "primaryDmg");
                                    canStillGather = true;
                                    break;
                                }
                            }
                        }


                        // ANTI NORMAL INSTAKILL
                        if (getPlayerInfo(enemy, "secondaryWeapon") == "hammer" || getPlayerInfo(enemy, "secondaryWeapon") == "musket" || getPlayerInfo(enemy, "secondaryWeapon") == "crossbow" || getPlayerInfo(enemy, "secondaryWeapon") == "repeater crossbow" || getPlayerInfo(enemy, "secondaryWeapon") == "bow") {
                            if (damagesByHits.length > 0 && UTILS.getDistance(enemy.x, enemy.y, myPlayer.x2, myPlayer.y2) <= 400) {
                                if (turretReload[enemy.sid] == 1) {
                                    turretDmgPot += 25;
                                    if (secondaryReload[enemy.sid] == 1) {
                                        if (getPlayerInfo(enemy, "secondaryWeapon") == "hammer") {
                                            secDmgPot += (getPlayerInfo(enemy, "secondaryDmg") / 1.5);
                                        }
                                        else {
                                            secDmgPot += getPlayerInfo(enemy, "secondaryDmg");
                                        }
                                    }
                                }
                                else if (secondaryReload[enemy.sid] == 1) {
                                    secDmgPot += getPlayerInfo(enemy, "secondaryDmg");
                                }
                            }
                        }

                        // ANTI SPIKE TICK
                        if (!collidingspike) {
                            for (let i = 0; i < 36; i++) {
                                let angle = UTILS.toRad(i * (360 / 36));
                                let id = 9;

                                let config = {
                                    x: enemy.x2 + (35 + items.list[id].scale + (items.list[id].placeOffset || 0)) * Math.cos(angle),
                                    y: enemy.y2 + (35 + items.list[id].scale + (items.list[id].placeOffset || 0)) * Math.sin(angle),
                                    scale: items.list[id].scale
                                };

                                if (objectManager.checkItemLocation(config.x, config.y, config.scale, 0.6, id, false, enemy, visibleObjects)) {
                                    if (UTILS.getDistance(myPlayer.xVel, myPlayer.yVel, config.x, config.y) <= 35 + config.scale) {
                                        if (inPrimaryRange && primaryReload[enemy.sid] == 1) {
                                            if (100 <= (getPlayerInfo(enemy, "primaryDmg") + 45)) {
                                                spikeTickAnti = true;
                                            }
                                            if ((myPlayer.health / 0.75) <= (getPlayerInfo(enemy, "primaryDmg") + 45)) {
                                                spikeDmgPot += 45;
                                                hitDmgPot += getPlayerInfo(enemy, "primaryDmg");
                                                break;
                                            }
                                        }
                                        else if (myPlayer.health <= 70 && damagesByHits.length > 0) {
                                            spikeDmgPot += 45;
                                            if (turretReload[enemy.sid]) {
                                                turretDmgPot += 25;
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }

                    lastcolliding = collidingspike;
                    iWasTrapped = imTrapped;
                    lastPredicted = predicted;

                    // Total dmg pot combine of all dmgs
                    totalDmgPot = spikeDmgPot + hitDmgPot + turretDmgPot + secDmgPot + poisonDmgPot;

                    if (totalDmgPot > 140)
                        totalDmgPot = 140;

                    if (totalDmgPot >= 100)
                        soldierAnti = true;



                    // PLAYER WEAPON
                    if (myPlayer.weaponIndex != predictWeapon || myPlayer.buildIndex >= 0) {
                        selectWeapon(predictWeapon);
                    }

                    // FIX GATHER GLITCH
                    if (checkGather) {
                        if (autogathering) {
                            autogathering = false;
                        }

                        checkGather = false;
                    }

                    // PLAYER AUTO GATHER
                    if (needAutoGather()) {
                        if (!autogathering) {
                            sendAutoGather();
                        }
                    } else {
                        if (autogathering) {
                            sendAutoGather();
                        }
                    }

                    // CHECK GATHER
                    if (myPlayer.buildIndex < 0) {
                        if (myPlayer.weaponIndex < 9) {
                            if (primaryReload[myPlayer.sid] == 1) {
                                checkGather = true;
                            }
                        } else {
                            if (secondaryReload[myPlayer.sid] == 1) {
                                checkGather = true;
                            }
                        }
                    }

                    // SHAME RESET
                    if (myPlayer.shameCount > 0 && !soldierAnti && !collidingspike && poisonDmgPot == 0 && totalDmgPot == 0) {
                        shouldResetShame = true;
                    }


                    // PLAYER hats & ACCESSORIES
                    hatFc();

                    spikeTickAnti = false;
                    shouldResetShame = false;

                    if (currentHat == 6)
                        totalDmgPot *= 0.75;
                    if (currentHat == 7)
                        totalDmgPot += 5;

                    if (myPlayer.health <= totalDmgPot)
                        healing = true;


                    // HEAL
                    let damageHealed = false;
                    if (((healing && myPlayer.shameCount < 7) || (tick - damageTick) > 0) && myPlayer.health < 100) {
                        heal(100 - myPlayer.health);
                        damageHealed = true;
                    }

                    // AUTO PLACER
                    getPredictObjects();
                    placedAngles = [];
                    for (let object of predictObjects) {
                        if (object.preplace) continue;
                        if (window.packets + 5 > 119) break;

                        place(object.id, object.angle);
                        placedAngles.push(object.angle);

                    }

                    // REPLACE
                    replaceVacated();

                    // PLAYER DIRECTION
                    let angle = getAttackDir();
                    if (predictObjects.length > 0 || damageHealed) {
                        io.send("D", angle);
                    } else {
                        if (Math.abs(myPlayer.d2 - angle) > 0.3) {
                            io.send("D", angle);
                        }
                    }
                } else {
                    predictObjects = [];

                    if (deathDamages.length > 0) {
                        //   addChatLog(`Mod: Predict Damages before death ${JSON.stringify(totalDmgPot)}`, "#ffffff");
                        //   addChatLog(`Mod: Damages before death ${JSON.stringify(deathDamages)}`, "#ffffff");

                        deathDamages = [];
                    }
                }

                for (let player of players) {
                    if (player.spikeDamage <= 0) continue;
                    player.spikeDamage = 0;
                }
            });

            // PRE PLACER
            setTimeout(function () {
                for (let object of predictObjects) {
                    if (!object.preplace) continue;
                    setPlaceTick();
                    getPrePlaceAngles(myPlayer.items[2], object.id, object.angle);
                    getPrePlaceAngles(myPlayer.items[4] || 15, object.id, object.angle);
                    io.send("D", getAttackDir());
                }
            }, 1);

            setTimeout(function () {
                for (let object of predictObjects) {
                    if (!object.preplace) continue;
                    if (window.packets + 5 > 119) break;

                    place(object.id, object.angle);
                    placedAngles.push(object.angle);
                    io.send("D", getAttackDir());
                }
            }, 111 - window.pingTime);

            setTimeout(function () {
                if (spamPrePlacer) {
                    for (let object of predictObjects) {
                        if (!object.preplace) continue;
                        if (window.packets + 5 > 119) break;

                        place(object.id, object.angle);
                        placedAngles.push(object.angle);
                        io.send("D", getAttackDir());
                    }
                }
            }, 111 - minPingTime);


            damagesByHits = [];
            spikeDamages = [];
        }

        let tickInterval;
        let tickPromiseResolve;

        function needAutoGather() {
            return (((ePress || autoaim || rightClick || leftClick) && !isBadTail()) || autoBreak || antiPush || gatherGrind);
        }



        function isBadTail() {
            if (autoaim) {
                if (myPlayer.tailIndex == 11) {
                    return true;
                }
            } else {
                if (predictWeapon < 8 && myPlayer.tailIndex == 11) {
                    return true;
                }
            }
        }

        // PATHFINDER WITH WEB WORKER
        let squeezablePointsCache = new Map();
        let pathfindingState = {
            active: false,
            currentPath: [],
            oldPath: [],
            lastDestination: null
        };

        // Helper function to check if a position is blocked by obstacles
        function isPositionBlocked(targetPos, pathMode) {
            // Check map boundaries
            let objects = visibleObjects.filter(obj => obj.id != 15 && !(obj.id > 5 && obj.id < 10 && !isObjectOur(obj)));
            if (pathMode.avoidEnemySpikes) {
                for (let spike of enemySpikes) {
                    objects.push(spike);
                }
            }
            for (let object of objects) {
                if (UTILS.getDistance(targetPos.x, targetPos.y, object.x, object.y) < object.scale + 35) {
                    return true;
                }
            }
            return false;
        }

        function getGridObjects(pathMode, MAX_DIST, destination) {
            let gridObjects = visibleObjects.filter(obj =>
                                                    UTILS.getDistance(obj.x, obj.y, destination.x, destination.y) < MAX_DIST &&
                                                    obj.id != 15
                                                   );

            if (pathMode.avoidEnemySpikes) {
                for (let spike of enemySpikes) {
                    if (UTILS.getDistance(spike.x, spike.y, destination.x, destination.y) < MAX_DIST) {
                        gridObjects.push(spike);
                    }
                }
            }

            return gridObjects;
        }

        function findSqueezablePoints(gridObjects) {
            squeezablePointsCache.clear();
            let squeezablePoints = [];

            for (let i = 0; i < gridObjects.length; i++) {
                for (let j = i + 1; j < gridObjects.length; j++) {
                    let obj1 = gridObjects[i];
                    let obj2 = gridObjects[j];

                    let radius1 = getActualRadius(obj1);
                    let radius2 = getActualRadius(obj2);

                    let distance = Math.sqrt(
                        Math.pow(obj2.x - obj1.x, 2) +
                        Math.pow(obj2.y - obj1.y, 2)
                    );

                    let combinedRadius = radius1 + radius2;
                    if (distance < combinedRadius && distance > 0) {
                        let midX = (obj1.x + obj2.x) / 2;
                        let midY = (obj1.y + obj2.y) / 2;

                        let distToObj1 = Math.sqrt(
                            Math.pow(midX - obj1.x, 2) +
                            Math.pow(midY - obj1.y, 2)
                        );

                        let distToObj2 = Math.sqrt(
                            Math.pow(midX - obj2.x, 2) +
                            Math.pow(midY - obj2.y, 2)
                        );

                        if (distToObj1 > obj1.scale + 9 && distToObj2 > obj2.scale + 9) {
                            let squeezablePoint = {
                                x: midX,
                                y: midY,
                                type: 'squeezable',
                                parentObj1Sid: obj1.sid,
                                parentObj2Sid: obj2.sid
                            };

                            squeezablePoints.push(squeezablePoint);
                            squeezablePointsCache.set(squeezablePoint, {
                                obj1Sid: obj1.sid,
                                obj2Sid: obj2.sid
                            });
                        }
                    }
                }
            }

            return squeezablePoints;
        }

        function updateDestination(destination) {
            return {
                x: destination.x,
                y: destination.y,
                type: 'destination'
            };
        }

        function updatePlayerPos() {
            return {
                x: myPlayer.x2,
                y: myPlayer.y2,
                type: 'player'
            }
        }

        function updateEnemyPoints(gridObjects) {
            if (!nearestEnemy) return [];

            const enemyX = nearestEnemy.x2;
            const enemyY = nearestEnemy.y2;
            const radius = 75;
            const points = [];

            for (let i = 0; i < 8; i++) {
                const angle = (i * Math.PI * 2) / 8;
                const x = enemyX + Math.cos(angle) * radius;
                const y = enemyY + Math.sin(angle) * radius;

                let isInsideObject = false;
                for (let obj of gridObjects) {
                    let objRadius = getActualRadius(obj);
                    let distance = Math.sqrt(
                        Math.pow(x - obj.x, 2) +
                        Math.pow(y - obj.y, 2)
                    );

                    if (distance < objRadius) {
                        isInsideObject = true;
                        break;
                    }
                }

                if (!isInsideObject) {
                    points.push({
                        x: x,
                        y: y,
                        type: 'enemy',
                        radius: radius
                    });
                }
            }

            return points;
        }

        function getActualRadius(object) {
            let radius = null;
            if (object.id > 5 && object.id < 10 && !isObjectOur(object)) radius = object.scale + 40;
            else if (object.type == 0) radius = object.scale - 25;
            else if (object.type == 1 && object.y >= config.mapScale - config.snowBiomeTop) radius = object.scale + 15;
            else if (object.type == 1) radius = object.scale + 5;
            else if (object.type == 2) radius = object.scale + 35;
            else if (object.type == 3) radius = object.scale + 35;
            else radius = object.scale + 35;
            return radius;
        }

        function updateObjectsPoints(gridObjects, pathMode) {
            let allObjectPoints = [];

            for (let firstobject of gridObjects) {
                const radius = getActualRadius(firstobject);
                const angleStep = (Math.PI * 2) / 8;

                for (let i = 0; i < 8; i++) {
                    const angle = angleStep * i;
                    const point = {
                        x: firstobject.x + Math.cos(angle) * radius,
                        y: firstobject.y + Math.sin(angle) * radius,
                        type: 'object',
                        objectSid: firstobject.sid
                    };

                    let isValid = true;

                    for (let secondobject of gridObjects) {
                        if (firstobject.sid === secondobject.sid) continue;

                        const otherRadius = getActualRadius(secondobject);
                        const distance = Math.sqrt(
                            Math.pow(point.x - secondobject.x, 2) +
                            Math.pow(point.y - secondobject.y, 2)
                        );

                        if (distance < otherRadius) {
                            isValid = false;
                            break;
                        }
                    }

                    if (isValid && nearestEnemy) {
                        const distToEnemy = Math.sqrt(
                            Math.pow(point.x - nearestEnemy.x2, 2) +
                            Math.pow(point.y - nearestEnemy.y2, 2)
                        );

                        if (pathMode.avoidEnemy && distToEnemy < 75) {
                            isValid = false;
                        }
                        else if (distToEnemy < 35) {
                            isValid = false;
                        }
                    }

                    if (isValid) {
                        allObjectPoints.push(point);
                    }
                }
            }

            return allObjectPoints;
        }

        function createRegularWaypoints(destination, gridObjects, MAX_DIST, spacing = 100) {
            const waypoints = [];
            const centerX = myPlayer.x2;
            const centerY = myPlayer.y2;

            // Create grid of waypoints with specified spacing
            const gridRange = MAX_DIST;
            for (let x = centerX - gridRange; x <= centerX + gridRange; x += spacing) {
                for (let y = centerY - gridRange; y <= centerY + gridRange; y += spacing) {
                    // Check if waypoint is inside any obstacle
                    let isBlocked = false;

                    for (let obj of gridObjects) {
                        const objRadius = getActualRadius(obj);
                        const dist = Math.sqrt(
                            Math.pow(x - obj.x, 2) +
                            Math.pow(y - obj.y, 2)
                        );

                        if (dist < objRadius) {
                            isBlocked = true;
                            break;
                        }
                    }

                    // Check if too close to enemy
                    if (!isBlocked && nearestEnemy) {
                        const distToEnemy = Math.sqrt(
                            Math.pow(x - nearestEnemy.x2, 2) +
                            Math.pow(y - nearestEnemy.y2, 2)
                        );

                        if (distToEnemy < 75) {
                            isBlocked = true;
                        }
                    }

                    // Check map boundaries
                    if (x < 35 || x > config.mapScale - 35 || y < 35 || y > config.mapScale - 35) {
                        isBlocked = true;
                    }

                    if (!isBlocked) {
                        waypoints.push({
                            x: x,
                            y: y,
                            type: 'waypoint'
                        });
                    }
                }
            }

            return waypoints;
        }

        function updateGrid(destination, gridObjects, pathMode) {
            let newGrid = [];

            newGrid.push(updateDestination(destination));
            newGrid.push(updatePlayerPos());

            if (pathMode.avoidEnemy && nearestEnemy) {
                let enemyPoints = updateEnemyPoints(gridObjects);
                newGrid.push(...enemyPoints);
            }

            let objectPoints = updateObjectsPoints(gridObjects, pathMode);
            newGrid.push(...objectPoints);

            let squeezablePoints = findSqueezablePoints(gridObjects);
            newGrid.push(...squeezablePoints);

            // Add regular waypoints with 100 unit spacing
            const MAX_DIST = 600;
            let regularWaypoints = createRegularWaypoints(destination, gridObjects, MAX_DIST, 100);
            newGrid.push(...regularWaypoints);

            return newGrid;
        }

        function drawGrid(grid) {
            const pointRadius = 4;
            grid.forEach(point => {
                const pixelX = point.x - xOffset;
                const pixelY = point.y - yOffset;

                mainContext.save();

                switch (point.type) {
                    case 'destination':
                        mainContext.fillStyle = '#00ff00';
                        break;
                    case 'player':
                        mainContext.fillStyle = '#0096ff';
                        break;
                    case 'enemy':
                        mainContext.fillStyle = '#ff0000';
                        break;
                    case 'squeezable':
                        mainContext.fillStyle = '#ffff00';
                        break;
                    case 'waypoint':
                        mainContext.fillStyle = '#ffffff';
                        break;
                    case 'object':
                        mainContext.fillStyle = '#808080';
                        break;
                    default:
                        mainContext.fillStyle = '#cccccc';
                }

                mainContext.beginPath();
                mainContext.arc(pixelX, pixelY, pointRadius, 0, Math.PI * 2);
                mainContext.fill();

                mainContext.restore();
            });
        }

        // Draw current path
        function drawPath(path) {
            if (!path || path.length < 2) return;

            mainContext.save();
            mainContext.strokeStyle = '#ffffffff';
            mainContext.lineWidth = 3;
            mainContext.beginPath();

            for (let i = 0; i < path.length; i++) {
                const pixelX = path[i].x - xOffset;
                const pixelY = path[i].y - yOffset;

                if (i === 0) {
                    mainContext.moveTo(pixelX, pixelY);
                } else {
                    mainContext.lineTo(pixelX, pixelY);
                }
            }

            mainContext.stroke();
            mainContext.restore();
        }

        // Create Web Worker
        const makeWorker = (fn) => {
            const blobURL = URL.createObjectURL(
                new Blob(["(", fn.toString(), ")()"], {
                    type: "application/javascript",
                })
            );
            const worker = new Worker(blobURL);
            URL.revokeObjectURL(blobURL);
            return worker;
        };

        const pathfindWorker = makeWorker(function () {
            function getDist(p1, p2) {
                return Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);
            }

            function findNearestNode(pos, grid) {
                let nearest = null;
                let minDist = Infinity;

                for (const node of grid) {
                    const dist = getDist(pos, node);
                    if (dist < minDist) {
                        minDist = dist;
                        nearest = node;
                    }
                }

                return nearest;
            }

            function getNeighbors(node, grid, maxDist = 100) {
                const neighbors = [];

                for (const other of grid) {
                    if (other === node) continue;

                    const dist = getDist(node, other);
                    if (dist <= maxDist) {
                        neighbors.push(other);
                    }
                }

                return neighbors;
            }

            function astar(startPos, goalPos, grid) {
                const start = findNearestNode(startPos, grid);
                const goal = findNearestNode(goalPos, grid);

                if (!start || !goal) {
                    return { success: false };
                }

                const openSet = [{
                    node: start,
                    cost: 0,
                    priority: getDist(start, goal),
                    parent: null
                }];

                const visited = new Set();
                const maxAttempts = 300;
                let attempts = 0;

                while (openSet.length > 0 && attempts < maxAttempts) {
                    attempts++;

                    openSet.sort((a, b) => a.priority - b.priority);
                    const current = openSet.shift();

                    const key = `${current.node.x},${current.node.y}`;
                    if (visited.has(key)) continue;
                    visited.add(key);

                    if (getDist(current.node, goal) <= 20) {
                        const path = [];
                        let node = current;
                        while (node) {
                            path.push({ x: node.node.x, y: node.node.y });
                            node = node.parent;
                        }
                        return { success: true, path: path.reverse() };
                    }

                    const neighbors = getNeighbors(current.node, grid);

                    for (const neighbor of neighbors) {
                        const neighborKey = `${neighbor.x},${neighbor.y}`;
                        if (visited.has(neighborKey)) continue;

                        const newCost = current.cost + getDist(current.node, neighbor);
                        const priority = newCost + getDist(neighbor, goal);

                        openSet.push({
                            node: neighbor,
                            cost: newCost,
                            priority: priority,
                            parent: current
                        });
                    }
                }

                return { success: false };
            }

            self.onmessage = (ev) => {
                const { startPos, goalPos, grid } = ev.data;
                const result = astar(startPos, goalPos, grid);
                self.postMessage(result);
            };
        });

        // Add this smoothing function after the worker definition
        function smoothPath(path, gridObjects, pathMode) {
            if (!path || path.length <= 2) return path;

            const smoothedPath = [path[0]]; // Always keep start point
            let currentIndex = 0;

            while (currentIndex < path.length - 1) {
                let farthestVisible = currentIndex + 1;

                // Find the farthest point we can see directly
                for (let i = currentIndex + 2; i < path.length; i++) {
                    if (isLineOfSightClear(path[currentIndex], path[i], gridObjects, pathMode)) {
                        farthestVisible = i;
                    } else {
                        break; // Stop if we hit an obstacle
                    }
                }

                smoothedPath.push(path[farthestVisible]);
                currentIndex = farthestVisible;
            }

            return smoothedPath;
        }

        // Line of sight check
        function isLineOfSightClear(start, end, gridObjects, pathMode) {
            const steps = 10; // Number of points to check along the line
            const dx = (end.x - start.x) / steps;
            const dy = (end.y - start.y) / steps;

            for (let i = 0; i <= steps; i++) {
                const checkPoint = {
                    x: start.x + dx * i,
                    y: start.y + dy * i
                };

                // Check if this point collides with any obstacle
                for (let obj of gridObjects) {
                    const objRadius = getActualRadius(obj);
                    const dist = Math.sqrt(
                        Math.pow(checkPoint.x - obj.x, 2) +
                        Math.pow(checkPoint.y - obj.y, 2)
                    );

                    // Add safety margin
                    if (dist < objRadius) {
                        return false; // Line of sight blocked
                    }
                }

                // Check enemy avoidance
                if (pathMode.avoidEnemy && nearestEnemy) {
                    const distToEnemy = Math.sqrt(
                        Math.pow(checkPoint.x - nearestEnemy.x2, 2) +
                        Math.pow(checkPoint.y - nearestEnemy.y2, 2)
                    );

                    if (distToEnemy < 70) {
                        return false; // Too close to enemy
                    }
                }
            }

            return true; // Line of sight is clear
        }

        // Update the worker response handler
        pathfindWorker.onmessage = (ev) => {
            if (ev.data.success) {
                let path = ev.data.path;

                if (path.length > 1) {
                    // Get grid objects for smoothing
                    const MAX_DIST = 600;
                    const destination = { x: path[path.length - 1].x, y: path[path.length - 1].y };
                    const gridObjects = getGridObjects(pathMode, MAX_DIST, destination);

                    // Smooth the path to remove zig-zags
                    path = smoothPath(path, gridObjects, pathMode);

                    pathfindingState.oldPath = pathfindingState.currentPath.slice();
                    pathfindingState.currentPath = path;
                    pathfindingState.active = true;

                    // Get next waypoint
                    const nextNode = path[1];
                    const currentNode = path[0];
                    const angle = Math.atan2(nextNode.y - currentNode.y, nextNode.x - currentNode.x);

                    // Send movement command
                    predictMoveAngle = angle;
                }
            } else {
                // Fallback: reuse old path
                if (pathfindingState.oldPath && pathfindingState.oldPath.length > 1) {
                    pathfindingState.currentPath = pathfindingState.oldPath.slice();
                    pathfindingState.active = true;

                    const [curr, next] = pathfindingState.currentPath;
                    const angle = Math.atan2(next.y - curr.y, next.x - curr.x);
                    predictMoveAngle = angle;
                } else {
                    // No path available
                    pathfindingState.active = false;
                    pathfindingState.currentPath = [];
                }
            }
        };

        // Check if player deviated from path
        function isPlayerOffPath(path) {
            if (!path || path.length < 2) return false;

            // Check distance to the next waypoint
            const nextWaypoint = path[1] || path[0];
            const distToPath = Math.sqrt(
                Math.pow(myPlayer.x2 - nextWaypoint.x, 2) +
                Math.pow(myPlayer.y2 - nextWaypoint.y, 2)
            );

            // If player is too far from next waypoint (more than 100 units), they're off path
            if (distToPath > 50) {
                return true;
            }

            return false;
        }

        // Check if path is blocked by obstacles
        function isPathBlocked(path, gridObjects, pathMode) {
            if (!path || path.length < 2) return false;

            // Check next few waypoints in the path
            const waypointsToCheck = Math.min(3, path.length - 1);

            for (let i = 1; i <= waypointsToCheck; i++) {
                const waypoint = path[i];

                // Check if waypoint is now inside an obstacle
                for (let obj of gridObjects) {
                    const objRadius = getActualRadius(obj);
                    const dist = Math.sqrt(
                        Math.pow(waypoint.x - obj.x, 2) +
                        Math.pow(waypoint.y - obj.y, 2)
                    );

                    if (dist < objRadius) {
                        return true; // Path is blocked!
                    }
                }

                // Check if too close to enemy (if avoiding)
                if (pathMode.avoidEnemy && nearestEnemy) {
                    const distToEnemy = Math.sqrt(
                        Math.pow(waypoint.x - nearestEnemy.x2, 2) +
                        Math.pow(waypoint.y - nearestEnemy.y2, 2)
                    );

                    if (distToEnemy < 70) {
                        return true; // Path blocked by enemy!
                    }
                }
            }

            return false;
        }

        // Main pathfinding function - call this every frame
        function pathfindTo(destination, pathMode) {
            if (!destination || !myPlayer) return;

            const MAX_DIST = 600;
            const playerDist = UTILS.getDistance(destination.x, destination.y, myPlayer.x2, myPlayer.y2);

            if (playerDist > MAX_DIST) {
                pathfindingState.active = false;
                return;
            }

            const gridObjects = getGridObjects(pathMode, MAX_DIST, destination);

            // Check if current path is blocked or player moved off path
            const pathBlocked = isPathBlocked(pathfindingState.currentPath, gridObjects, pathMode);
            const playerOffPath = isPlayerOffPath(pathfindingState.currentPath);

            // Check if player reached next waypoint
            if (pathfindingState.currentPath.length > 1) {
                const nextWaypoint = pathfindingState.currentPath[1];
                const distToNext = UTILS.getDistance(myPlayer.x2, myPlayer.y2, nextWaypoint.x, nextWaypoint.y);

                if (distToNext < 35) {
                    // Remove reached waypoint
                    pathfindingState.currentPath.shift();
                }
            }

            // Recalculate if: no active path, destination moved, path is blocked, or player off path
            const shouldRecalculate = !pathfindingState.active ||
                  !pathfindingState.lastDestination ||
                  UTILS.getDistance(
                      destination.x, destination.y,
                      pathfindingState.lastDestination.x,
                      pathfindingState.lastDestination.y
                  ) > 0 ||
                  pathBlocked ||
                  playerOffPath;

            if (shouldRecalculate) {
                const grid = updateGrid(destination, gridObjects, pathMode);

                if (grid && grid.length > 0) {
                    // Send pathfinding request to worker
                    pathfindWorker.postMessage({
                        startPos: { x: myPlayer.x2, y: myPlayer.y2 },
                        goalPos: { x: destination.x, y: destination.y },
                        grid: grid
                    });

                    pathfindingState.lastDestination = { x: destination.x, y: destination.y };
                }
            }

            // Draw current path
            if (pathfindingState.active && pathfindingState.currentPath.length > 0) {
                return pathfindingState.currentPath;
            }
        }

        // Replace the drawPath function with this
        function drawMoveDirection() {
            if (!pathfindingState.active || pathfindingState.currentPath.length < 2) return;

            const nextWaypoint = pathfindingState.currentPath[1];
            const playerX = myPlayer.x2 - xOffset;
            const playerY = myPlayer.y2 - yOffset;
            const targetX = nextWaypoint.x - xOffset;
            const targetY = nextWaypoint.y - yOffset;

            // Calculate angle
            const angle = Math.atan2(targetY - playerY, targetX - playerX);

            mainContext.save();

            // Draw arrow from player towards target
            const arrowLength = 60;
            const arrowEndX = playerX + Math.cos(angle) * arrowLength;
            const arrowEndY = playerY + Math.sin(angle) * arrowLength;

            // Main arrow line
            mainContext.strokeStyle = '#747474ff';
            mainContext.lineWidth = 4;
            mainContext.shadowColor = '#7e7e7eff';
            mainContext.shadowBlur = 10;
            mainContext.beginPath();
            mainContext.moveTo(playerX, playerY);
            mainContext.lineTo(arrowEndX, arrowEndY);
            mainContext.stroke();

            // Arrow head
            const headLength = 15;
            const headAngle = Math.PI / 6;

            mainContext.beginPath();
            mainContext.moveTo(arrowEndX, arrowEndY);
            mainContext.lineTo(
                arrowEndX - headLength * Math.cos(angle - headAngle),
                arrowEndY - headLength * Math.sin(angle - headAngle)
            );
            mainContext.moveTo(arrowEndX, arrowEndY);
            mainContext.lineTo(
                arrowEndX - headLength * Math.cos(angle + headAngle),
                arrowEndY - headLength * Math.sin(angle + headAngle)
            );
            mainContext.stroke();

            // Optional: Draw a small circle at the next waypoint
            mainContext.fillStyle = '#ff0707ff';
            mainContext.shadowBlur = 15;
            mainContext.beginPath();
            mainContext.arc(targetX, targetY, 8, 0, Math.PI * 2);
            mainContext.fill();

            mainContext.restore();
        }

        // Or for a more minimal compass-style indicator:
        function drawCompassDirection() {
            if (!pathfindingState.active || pathfindingState.currentPath.length < 2) return;

            const nextWaypoint = pathfindingState.currentPath[1];
            const angle = Math.atan2(
                nextWaypoint.y - myPlayer.y2,
                nextWaypoint.x - myPlayer.x2
            );

            // Draw on top-left corner of screen
            const compassX = 80;
            const compassY = 80;
            const radius = 40;

            mainContext.save();

            // Background circle
            mainContext.fillStyle = 'rgba(0, 0, 0, 0.5)';
            mainContext.beginPath();
            mainContext.arc(compassX, compassY, radius, 0, Math.PI * 2);
            mainContext.fill();

            // Direction arrow
            mainContext.strokeStyle = '#00ff00';
            mainContext.fillStyle = '#00ff00';
            mainContext.lineWidth = 3;
            mainContext.shadowColor = '#00ff00';
            mainContext.shadowBlur = 10;

            const arrowLength = radius - 10;
            const arrowX = compassX + Math.cos(angle) * arrowLength;
            const arrowY = compassY + Math.sin(angle) * arrowLength;

            // Arrow line
            mainContext.beginPath();
            mainContext.moveTo(compassX, compassY);
            mainContext.lineTo(arrowX, arrowY);
            mainContext.stroke();

            // Arrow head
            const headLength = 10;
            const headAngle = Math.PI / 6;

            mainContext.beginPath();
            mainContext.moveTo(arrowX, arrowY);
            mainContext.lineTo(
                arrowX - headLength * Math.cos(angle - headAngle),
                arrowY - headLength * Math.sin(angle - headAngle)
            );
            mainContext.lineTo(
                arrowX - headLength * Math.cos(angle + headAngle),
                arrowY - headLength * Math.sin(angle + headAngle)
            );
            mainContext.closePath();
            mainContext.fill();

            mainContext.restore();
        }


        function hatFc() {
            // HAT
            currentHat = 0;
            if (isBoughtHat(6, 0)) {
                currentHat = 6;
            }

            if (isBoughtHat(12, 0)) {
                currentHat = 12;
            }

            if(isBoughtHat(6,0) && nearestEnemy && UTILS.getDistance(nearestEnemy.x2, nearestEnemy.y2, myPlayer.x2, myPlayer.y2) < 300 && window.vars.safeSoldier) {
                currentHat = 6;
            }

            if (myPlayer.y < 2400 && isBoughtHat(15, 0)) {
                currentHat = 15;
            }

            if ((myPlayer.y > 6838 && myPlayer.y < 7562) && isBoughtHat(31, 0)) {
                currentHat = 31;
            }

            if (autogathering && isBoughtHat(6, 0)) {
                currentHat = 6;
            }

            if (isBoughtHat(7, 0)) {
                if (shouldResetShame) {
                    currentHat = 7;
                }
            }

            if (((imTrapped && spikeDmgCount > 0) || spikeTickAnti) && isBoughtHat(6, 0)) {
                currentHat = 6;
            }

            if (autogathering) {
                if (predictWeapon < 9) {
                    if (primaryReload[myPlayer.sid] == 1) {
                        if (autoBreak) {
                            if (antiPush) {
                                if (isBoughtHat(7, 0)) {
                                    currentHat = 7;
                                }
                            } else {
                                if (isBoughtHat(40, 0)) {
                                    currentHat = 40;
                                }
                            }
                        } else {
                            if (predictWeapon < 8 && nearestEnemy && UTILS.getDistance(myPlayer.xVel, myPlayer.yVel, nearestEnemy.xVel, nearestEnemy.yVel) <= (35 * 1.8 + items.weapons[predictWeapon].range)) {
                                if (isBoughtHat(7, 0)) {
                                    currentHat = 7;
                                }
                            } else {
                                if (isBoughtHat(40, 0)) {
                                    currentHat = 40;
                                }
                            }
                        }
                    }
                } else if (predictWeapon != 11) {
                    if (secondaryReload[myPlayer.sid] == 1) {
                        if (predictWeapon == 10) {
                            if (isBoughtHat(40, 0)) {
                                currentHat = 40;
                            }
                        } else {
                            if (isBoughtHat(20, 0)) {
                                currentHat = 20;
                            }
                        }
                    }
                }
            }

            // ACC
            let currentAcc = 0;
            if (isBoughtHat(11, 1)) {
                currentAcc = 11;
            }

            if (nearestEnemy && UTILS.getDistance(myPlayer.x2, myPlayer.y2, nearestEnemy.x2, nearestEnemy.y2) <= 300 && myPlayer.weapons[0] != 7 && myPlayer.weapons[0] != 6) {
                currentAcc = 0;
                if (isBoughtHat(19, 1)) {
                    currentAcc = 19;
                }
            }

            if (nearestTrap && (myPlayer.weapons[0] == 7 || myPlayer.weapons[0] == 6)) {
                currentAcc = 0;
                if (isBoughtHat(19, 1)) {
                    currentAcc = 19;
                }
            }

            if (autogathering && predictWeapon < 9) {
                currentAcc = 0;
                if (isBoughtHat(19, 1)) {
                    currentAcc = 19;
                }
            }

            if (myPlayer.weapons[0] == 8 && isBoughtHat(11, 1)) {
                currentAcc = 11;
            }

            // HAT & ACC

            if ((insta.primaryturret || insta.turret) && isBoughtHat(53, 0) && turretReload[myPlayer.sid] == 1) {
                currentHat = 53;
            }

            if (insta.primary && isBoughtHat(7, 0)) {
                currentHat = 7;
            }

            if (insta.secondary && isBoughtHat(40, 0)) {
                currentHat = 40;
            }


            if ((ePress || autoaim || leftClick) && isBadTail()) {
                currentHat = myPlayer.skinIndex;

                currentAcc = 0;
                if (isBoughtHat(19, 1)) {
                    currentAcc = 19;
                }
            }

            if (isBoughtHat(6, 0)) {
                if (soldierAnti) {
                    currentHat = 6;
                }
            }

            // EQUIP
            hat(currentHat);
            acc(currentAcc);
        }

        // FIND OBJECTS BY ID/SID:
        function findPlayerByID(id) {
            for (var i = 0; i < players.length; ++i) {
                if (players[i].id == id) {
                    return players[i];
                }
            } return null;
        }
        function findPlayerBySID(sid) {
            for (var i = 0; i < players.length; ++i) {
                if (players[i].sid == sid) {
                    return players[i];
                }
            } return null;
        }
        function findAIBySID(sid) {
            for (var i = 0; i < ais.length; ++i) {
                if (ais[i].sid == sid) {
                    return ais[i];
                }
            } return null;
        }
        function findObjectBySid(sid) {
            for (var i = 0; i < gameObjects.length; ++i) {
                if (gameObjects[i].sid == sid) {
                    return gameObjects[i];
                }
            } return null;
        }
        //idk
        function findAllianceBySid(sid) {
            for (let i = 0; i < alliancePlayers.length; i += 2) {
                if (alliancePlayers[i] == sid) {
                    return alliancePlayers[i];
                }
            } return null;
        }

        let pings = [];
        let minPingTime = Infinity;
        let maxPingTime = 0;
        let averagePing = 0;
        let isFirstPing = true;

        let frameTimes = [];
        let fps = 0;

        function trackFPS() {
            let now = performance.now();
            frameTimes.push(now);

            while (frameTimes.length > 0 && frameTimes[0] <= now - 1000) {
                frameTimes.shift();
            }

            fps = frameTimes.length;
            requestAnimationFrame(trackFPS);
        }

        requestAnimationFrame(trackFPS);

        // PING:
        var lastPing = -1;
        function pingSocketResponse() {
            var pingTime = Date.now() - lastPing;
            window.pingTime = pingTime;

            if (!isFirstPing) {
                if (pings.length > 200) {
                    pings = [];
                }

                pings.push(pingTime);

                averagePing = 0;
                for (let ping of pings) {
                    averagePing += ping;
                }

                averagePing = averagePing / pings.length;
                if (pingTime < minPingTime) {
                    minPingTime = pingTime;
                }

                if (pingTime > maxPingTime) {
                    maxPingTime = pingTime;
                }
            } else {
                isFirstPing = false;
            }

            pingDisplay.innerText = `Ping: ${window.pingTime} ms | Min: ${minPingTime} ms | Max: ${maxPingTime} ms | Average: ${averagePing} ms | FPS: ${fps}`;
        }
        function pingSocket() {
            lastPing = Date.now();
            io.send("0");
        }

        // SERVER SHUTDOWN NOTICE:
        function serverShutdownNotice(countdown) {
            if (countdown < 0) return;

            var minutes = Math.floor(countdown / 60);
            var seconds = countdown % 60;
            seconds = ("0" + seconds).slice(-2);

            shutdownDisplay.innerText = "Server restarting in " + minutes + ":" + seconds;
            shutdownDisplay.hidden = false;
        }

        // UPDATE & ANIMATE:
        function doUpdate() {
            now = Date.now();
            delta = now - lastUpdate;
            lastUpdate = now;
            updateGame();
            requestAnimationFrame(doUpdate);
        }

        // START GAME:
        function startGame() {
            bindEvents();
            loadIcons();
            loadingText.style.display = "none";
            menuCardHolder.style.display = "block";
            // nameInput.value = getSavedVal("moo_name")||"";
            prepareUI();
        }
        prepareMenuBackground();
        doUpdate();

        // OPEN LINK:
        function openLink(link) {
            window.open(link, "_blank")
        }

        // EXPORT VALUES:
        window.openLink = openLink;
        window.aJoinReq = aJoinReq;
        window.follmoo = follmoo;
        window.kickFromClan = kickFromClan;
        window.sendJoin = sendJoin;
        window.leaveAlliance = leaveAlliance;
        window.createAlliance = createAlliance;
        window.storeBuy = storeBuy;
        window.storeEquip = storeEquip;
        window.showItemInfo = showItemInfo;
        window.selectSkinColor = selectSkinColor;
        window.changeStoreIndex = changeStoreIndex;
        window.config = config;


        /***/
    }),

    /***/ "./src/js/config.js":
    /*!**************************!*\
  !*** ./src/js/config.js ***!
  \**************************/
    /*! no static exports found */
    /***/ (function (module, exports, __webpack_require__) {

        /* WEBPACK VAR INJECTION */(function (process) {
            // RENDER:
            module.exports.maxScreenWidth = 1920;
            module.exports.maxScreenHeight = 1080;

            // SERVER:
            module.exports.serverUpdateRate = 9;
            module.exports.tickRate = (1000 / module.exports.serverUpdateRate);
            module.exports.maxPlayers = Infinity; // (process && process.argv.indexOf("--largeserver") != -1) ? 80 : 50;
            module.exports.maxPlayersHard = Infinity; // module.exports.maxPlayers + 10;
            module.exports.collisionDepth = 6;
            module.exports.minimapRate = 3000;

            // COLLISIONS:
            module.exports.colGrid = 10;

            // CLIENT:
            module.exports.clientSendRate = 5;

            // UI:
            module.exports.healthBarWidth = 50;
            module.exports.healthBarPad = 4.5;
            module.exports.iconPadding = 15;
            module.exports.iconPad = 0.9;
            module.exports.deathFadeout = 0;
            module.exports.crownIconScale = 60;
            module.exports.crownPad = 35;

            // CHAT:
            module.exports.chatCountdown = 3000;
            module.exports.chatCooldown = 500;

            // SANDBOX:
            module.exports.inSandbox = process && process.env.VULTR_SCHEME === "mm_exp";
            module.exports.isSandbox = window.location.hostname == "sandbox.moomoo.io";

            // PLAYER:
            module.exports.maxAge = 100;
            module.exports.gatherAngle = Math.PI / 2.6;
            module.exports.gatherWiggle = 10;
            module.exports.hitReturnRatio = 0.25;
            module.exports.hitAngle = Math.PI / 2;
            module.exports.playerScale = 35;
            module.exports.playerSpeed = 0.0016;
            module.exports.playerDecel = 0.993;
            module.exports.nameY = 34;

            // CUSTOMIZATION:
            module.exports.skinColors = ["#bf8f54", "#cbb091", "#896c4b",
                                         "#fadadc", "#ececec", "#c37373", "#4c4c4c", "#ecaff7", "#738cc3",
                                         "#8bc373", "#91b2db"];

            // ANIMALS:
            module.exports.animalCount = 7;
            module.exports.aiTurnRandom = 0.06;
            module.exports.cowNames = ["Sid", "Steph", "Bmoe", "Romn", "Jononthecool", "Fiona", "Vince", "Nathan", "Nick", "Flappy", "Ronald", "Otis", "Pepe", "Mc Donald", "Theo", "Fabz", "Oliver", "Jeff", "Jimmy", "Helena", "Reaper",
                                       "Ben", "Alan", "Naomi", "XYZ", "Clever", "Jeremy", "Mike", "Destined", "Stallion", "Allison", "Meaty", "Sophia", "Vaja", "Joey", "Pendy", "Murdoch", "Theo", "Jared", "July", "Sonia", "Mel", "Dexter", "Quinn", "Milky"];

            // WEAPONS:
            module.exports.shieldAngle = Math.PI / 3;
            module.exports.weaponVariants = [{
                id: 0,
                src: "",
                xp: 0,
                val: 1
            }, {
                id: 1,
                src: "_g",
                xp: 3000,
                val: 1.1
            }, {
                id: 2,
                src: "_d",
                xp: 7000,
                val: 1.18
            }, {
                id: 3,
                src: "_r",
                poison: true,
                xp: 12000,
                val: 1.18
            }];
            module.exports.fetchVariant = function (player) {
                var tmpXP = player.weaponXP[player.weaponIndex] || 0;
                for (var i = module.exports.weaponVariants.length - 1; i >= 0; --i) {
                    if (tmpXP >= module.exports.weaponVariants[i].xp)
                        return module.exports.weaponVariants[i];
                }
            };

            // NATURE:
            module.exports.resourceTypes = ["wood", "food", "stone", "points"];
            module.exports.areaCount = 7;
            module.exports.treesPerArea = 9;
            module.exports.bushesPerArea = 3;
            module.exports.totalRocks = 32;
            module.exports.goldOres = 7;
            module.exports.riverWidth = 724;
            module.exports.riverPadding = 114;
            module.exports.waterCurrent = 0.0011;
            module.exports.waveSpeed = 0.0001;
            module.exports.waveMax = 1.3;
            module.exports.treeScales = [150, 160, 165, 175];
            module.exports.bushScales = [80, 85, 95];
            module.exports.rockScales = [80, 85, 90];

            // BIOME DATA:
            module.exports.snowBiomeTop = 2400;
            module.exports.snowSpeed = 0.75;

            // DATA:
            module.exports.maxNameLength = 15;

            // MAP:
            module.exports.mapScale = 14400;
            module.exports.mapPingScale = 40;
            module.exports.mapPingTime = 2200;

            /* WEBPACK VAR INJECTION */
        }.call(this, __webpack_require__(/*! ./../../node_modules/process/browser.js */ "./node_modules/process/browser.js")))

        /***/
    }),

    /***/ "./src/js/data/ai.js":
    /*!***************************!*\
  !*** ./src/js/data/ai.js ***!
  \***************************/
    /*! no static exports found */
    /***/ (function (module, exports) {


        var PI2 = Math.PI * 2;
        module.exports = function (sid, objectManager, players, items, UTILS, config, scoreCallback, server) {
            this.sid = sid;
            this.isAI = true;
            this.nameIndex = UTILS.randInt(0, config.cowNames.length - 1);

            // INIT:
            this.init = function (x, y, dir, index, data) {
                this.x = x;
                this.y = y;
                this.startX = data.fixedSpawn ? x : null;
                this.startY = data.fixedSpawn ? y : null;
                this.xVel = 0;
                this.yVel = 0;
                this.zIndex = 0;
                this.dir = dir;
                this.dirPlus = 0;
                this.index = index;
                this.src = data.src;
                if (data.name) this.name = data.name;
                this.weightM = data.weightM;
                this.speed = data.speed;
                this.killScore = data.killScore;
                this.turnSpeed = data.turnSpeed;
                this.scale = data.scale;
                this.maxHealth = data.health;
                this.leapForce = data.leapForce;
                this.health = this.maxHealth;
                this.chargePlayer = data.chargePlayer;
                this.viewRange = data.viewRange;
                this.drop = data.drop;
                this.dmg = data.dmg;
                this.hostile = data.hostile;
                this.dontRun = data.dontRun;
                this.hitRange = data.hitRange;
                this.hitDelay = data.hitDelay;
                this.hitScare = data.hitScare;
                this.spriteMlt = data.spriteMlt;
                this.nameScale = data.nameScale;
                this.colDmg = data.colDmg;
                this.noTrap = data.noTrap;
                this.spawnDelay = data.spawnDelay;
                this.hitWait = 0;
                this.waitCount = 1000;
                this.moveCount = 0;
                this.targetDir = 0;
                this.active = true;
                this.alive = true;
                this.runFrom = null;
                this.chargeTarget = null;
                this.dmgOverTime = {};
            };

            // UPDATE:
            var timerCount = 0;
            this.update = function (delta) {
                if (this.active) {

                    // SPAWN DELAY:
                    if (this.spawnCounter) {
                        this.spawnCounter -= delta;
                        if (this.spawnCounter <= 0) {
                            this.spawnCounter = 0;
                            this.x = this.startX || UTILS.randInt(0, config.mapScale);
                            this.y = this.startY || UTILS.randInt(0, config.mapScale);
                        }
                        return;
                    }

                    // REGENS AND AUTO:
                    timerCount -= delta;
                    if (timerCount <= 0) {
                        if (this.dmgOverTime.dmg) {
                            this.changeHealth(-this.dmgOverTime.dmg, this.dmgOverTime.doer);
                            this.dmgOverTime.time -= 1;
                            if (this.dmgOverTime.time <= 0)
                                this.dmgOverTime.dmg = 0;
                        }
                        timerCount = 1000;
                    }

                    // BEHAVIOUR:
                    var charging = false;
                    var slowMlt = 1;
                    if (!this.zIndex && !this.lockMove && this.y >= (config.mapScale / 2) - (config.riverWidth / 2) &&
                        this.y <= (config.mapScale / 2) + (config.riverWidth / 2)) {
                        slowMlt = 0.33;
                        this.xVel += config.waterCurrent * delta;
                    }
                    if (this.lockMove) {
                        this.xVel = 0;
                        this.yVel = 0;
                    } else if (this.waitCount > 0) {
                        this.waitCount -= delta;
                        if (this.waitCount <= 0) {
                            if (this.chargePlayer) {
                                var tmpPlayer, bestDst, tmpDist;
                                for (var i = 0; i < players.length; ++i) {
                                    if (players[i].alive && !(players[i].skin && players[i].skin.bullRepel)) {
                                        tmpDist = UTILS.getDistance(this.x, this.y, players[i].x, players[i].y);
                                        if (tmpDist <= this.viewRange && (!tmpPlayer || tmpDist < bestDst)) {
                                            bestDst = tmpDist;
                                            tmpPlayer = players[i];
                                        }
                                    }
                                }
                                if (tmpPlayer) {
                                    this.chargeTarget = tmpPlayer;
                                    this.moveCount = UTILS.randInt(8000, 12000);
                                } else {
                                    this.moveCount = UTILS.randInt(1000, 2000);
                                    this.targetDir = UTILS.randFloat(-Math.PI, Math.PI);
                                }
                            } else {
                                this.moveCount = UTILS.randInt(4000, 10000);
                                this.targetDir = UTILS.randFloat(-Math.PI, Math.PI);
                            }
                        }
                    } else if (this.moveCount > 0) {
                        var tmpSpd = this.speed * slowMlt;
                        if (this.runFrom && this.runFrom.active && !(this.runFrom.isPlayer && !this.runFrom.alive)) {
                            this.targetDir = UTILS.getDirection(this.x, this.y, this.runFrom.x, this.runFrom.y);
                            tmpSpd *= 1.42;
                        } else if (this.chargeTarget && this.chargeTarget.alive) {
                            this.targetDir = UTILS.getDirection(this.chargeTarget.x, this.chargeTarget.y, this.x, this.y);
                            tmpSpd *= 1.75;
                            charging = true;
                        } if (this.hitWait) {
                            tmpSpd *= 0.3;
                        }
                        if (this.dir != this.targetDir) {
                            this.dir %= PI2;
                            var netAngle = (this.dir - this.targetDir + PI2) % PI2;
                            var amnt = Math.min(Math.abs(netAngle - PI2), netAngle, this.turnSpeed * delta);
                            var sign = (netAngle - Math.PI) >= 0 ? 1 : -1;
                            this.dir += sign * amnt + PI2;
                        }
                        this.dir %= PI2;
                        this.xVel += (tmpSpd * delta) * Math.cos(this.dir);
                        this.yVel += (tmpSpd * delta) * Math.sin(this.dir);
                        this.moveCount -= delta;
                        if (this.moveCount <= 0) {
                            this.runFrom = null;
                            this.chargeTarget = null;
                            this.waitCount = this.hostile ? 1500 : UTILS.randInt(1500, 6000);
                        }
                    }

                    // OBJECT COLL:
                    this.zIndex = 0;
                    this.lockMove = false;
                    var tmpList;
                    var tmpSpeed = UTILS.getDistance(0, 0, this.xVel * delta, this.yVel * delta);
                    var depth = Math.min(4, Math.max(1, Math.round(tmpSpeed / 40)));
                    var tMlt = 1 / depth;
                    for (var i = 0; i < depth; ++i) {
                        if (this.xVel)
                            this.x += (this.xVel * delta) * tMlt;
                        if (this.yVel)
                            this.y += (this.yVel * delta) * tMlt;
                        tmpList = objectManager.getGridArrays(this.x, this.y, this.scale);
                        for (var x = 0; x < tmpList.length; ++x) {
                            for (var y = 0; y < tmpList[x].length; ++y) {
                                if (tmpList[x][y].active)
                                    objectManager.checkCollision(this, tmpList[x][y], tMlt);
                            }
                        }
                    }

                    // HITTING:
                    var hitting = false;
                    if (this.hitWait > 0) {
                        this.hitWait -= delta;
                        if (this.hitWait <= 0) {
                            hitting = true;
                            this.hitWait = 0;
                            if (this.leapForce && !UTILS.randInt(0, 2)) {
                                this.xVel += this.leapForce * Math.cos(this.dir);
                                this.yVel += this.leapForce * Math.sin(this.dir);
                            }
                            var tmpList = objectManager.getGridArrays(this.x, this.y, this.hitRange);
                            var tmpObj, tmpDst;
                            for (var t = 0; t < tmpList.length; ++t) {
                                for (var x = 0; x < tmpList[t].length; ++x) {
                                    tmpObj = tmpList[t][x];
                                    if (tmpObj.health) {
                                        tmpDst = UTILS.getDistance(this.x, this.y, tmpObj.x, tmpObj.y);
                                        if (tmpDst < tmpObj.scale + this.hitRange) {
                                            if (tmpObj.changeHealth(-this.dmg * 5)) objectManager.disableObj(tmpObj);
                                            objectManager.hitObj(tmpObj, UTILS.getDirection(this.x, this.y, tmpObj.x, tmpObj.y));
                                        }
                                    }
                                }
                            }
                            for (var x = 0; x < players.length; ++x) {
                                if (players[x].canSee(this)) {
                                    server.send(players[x].id, "J", this.sid);
                                }
                            }
                        }
                    }

                    // PLAYER COLLISIONS:
                    if (charging || hitting) {
                        var tmpObj, tmpDst, tmpDir;
                        for (var i = 0; i < players.length; ++i) {
                            tmpObj = players[i];
                            if (tmpObj && tmpObj.alive) {
                                tmpDst = UTILS.getDistance(this.x, this.y, tmpObj.x, tmpObj.y);
                                if (this.hitRange) {
                                    if (!this.hitWait && tmpDst <= this.hitRange + tmpObj.scale) {
                                        if (hitting) {
                                            tmpDir = UTILS.getDirection(tmpObj.x, tmpObj.y, this.x, this.y);
                                            tmpObj.changeHealth(-this.dmg);
                                            tmpObj.xVel += 0.6 * Math.cos(tmpDir);
                                            tmpObj.yVel += 0.6 * Math.sin(tmpDir);
                                            this.runFrom = null;
                                            this.chargeTarget = null;
                                            this.waitCount = 3000;
                                            this.hitWait = (!UTILS.randInt(0, 2) ? 600 : 0);
                                        } else this.hitWait = this.hitDelay;
                                    }
                                } else if (tmpDst <= this.scale + tmpObj.scale) {
                                    tmpDir = UTILS.getDirection(tmpObj.x, tmpObj.y, this.x, this.y);
                                    tmpObj.changeHealth(-this.dmg);
                                    tmpObj.xVel += 0.55 * Math.cos(tmpDir);
                                    tmpObj.yVel += 0.55 * Math.sin(tmpDir);
                                }
                            }
                        }
                    }

                    // DECEL:
                    if (this.xVel)
                        this.xVel *= Math.pow(config.playerDecel, delta);
                    if (this.yVel)
                        this.yVel *= Math.pow(config.playerDecel, delta);

                    // MAP BOUNDARIES:
                    var tmpScale = this.scale;
                    if (this.x - tmpScale < 0) {
                        this.x = tmpScale;
                        this.xVel = 0;
                    } else if (this.x + tmpScale > config.mapScale) {
                        this.x = config.mapScale - tmpScale;
                        this.xVel = 0;
                    } if (this.y - tmpScale < 0) {
                        this.y = tmpScale;
                        this.yVel = 0;
                    } else if (this.y + tmpScale > config.mapScale) {
                        this.y = config.mapScale - tmpScale;
                        this.yVel = 0;
                    }

                }
            };

            // CAN SEE:
            this.canSee = function (other) {
                if (!other) return false;
                if (other.skin && other.skin.invisTimer && other.noMovTimer
                    >= other.skin.invisTimer) return false;
                var dx = Math.abs(other.x - this.x) - other.scale;
                var dy = Math.abs(other.y - this.y) - other.scale;
                return dx <= (config.maxScreenWidth / 2) * 1.3 && dy <= (config.maxScreenHeight / 2) * 1.3;
            };

            var tmpRatio = 0;
            var animIndex = 0;
            this.animate = function (delta) {
                if (this.animTime > 0) {
                    this.animTime -= delta;
                    if (this.animTime <= 0) {
                        this.animTime = 0;
                        this.dirPlus = 0;
                        tmpRatio = 0;
                        animIndex = 0;
                    } else {
                        if (animIndex == 0) {
                            tmpRatio += delta / (this.animSpeed * config.hitReturnRatio);
                            this.dirPlus = UTILS.lerp(0, this.targetAngle, Math.min(1, tmpRatio));
                            if (tmpRatio >= 1) {
                                tmpRatio = 1;
                                animIndex = 1;
                            }
                        } else {
                            tmpRatio -= delta / (this.animSpeed * (1 - config.hitReturnRatio));
                            this.dirPlus = UTILS.lerp(0, this.targetAngle, Math.max(0, tmpRatio));
                        }
                    }
                }
            };

            // ANIMATION:
            this.startAnim = function () {
                this.animTime = this.animSpeed = 600;
                this.targetAngle = Math.PI * 0.8;
                tmpRatio = 0;
                animIndex = 0;
            };

            // CHANGE HEALTH:
            this.changeHealth = function (val, doer, runFrom) {
                if (this.active) {
                    this.health += val;
                    if (runFrom) {
                        if (this.hitScare && !UTILS.randInt(0, this.hitScare)) {
                            this.runFrom = runFrom;
                            this.waitCount = 0;
                            this.moveCount = 2000;
                        } else if (this.hostile && this.chargePlayer && runFrom.isPlayer) {
                            this.chargeTarget = runFrom;
                            this.waitCount = 0;
                            this.moveCount = 8000;
                        } else if (!this.dontRun) {
                            this.runFrom = runFrom;
                            this.waitCount = 0;
                            this.moveCount = 2000;
                        }
                    }
                    if (val < 0 && this.hitRange && UTILS.randInt(0, 1)) this.hitWait = 500;
                    if (doer && doer.canSee(this) && val < 0) {
                        server.send(doer.id, "8", Math.round(this.x),
                                    Math.round(this.y), Math.round(-val), 1);
                    } if (this.health <= 0) {
                        if (this.spawnDelay) {
                            this.spawnCounter = this.spawnDelay;
                            this.x = -1000000;
                            this.y = -1000000;
                        } else {
                            this.x = this.startX || UTILS.randInt(0, config.mapScale);
                            this.y = this.startY || UTILS.randInt(0, config.mapScale);
                        }
                        this.health = this.maxHealth;
                        this.runFrom = null;
                        if (doer) {
                            scoreCallback(doer, this.killScore);
                            if (this.drop) {
                                for (var i = 0; i < this.drop.length;) {
                                    doer.addResource(config.resourceTypes.indexOf(this.drop[i]), this.drop[i + 1]);
                                    i += 2;
                                }
                            }
                        }
                    }
                }
            };

        };


        /***/
    }),

    /***/ "./src/js/data/aiManager.js":
    /*!**********************************!*\
  !*** ./src/js/data/aiManager.js ***!
  \**********************************/
    /*! no static exports found */
    /***/ (function (module, exports) {


        // AI MANAGER:
        module.exports = function (ais, AI, players, items, objectManager, config, UTILS, scoreCallback, server) {

            // AI TYPES:
            this.aiTypes = [{
                id: 0,
                src: "cow_1",
                killScore: 150,
                health: 500,
                weightM: 0.8,
                speed: 0.00095,
                turnSpeed: 0.001,
                scale: 72,
                drop: ["food", 50]
            }, {
                id: 1,
                src: "pig_1",
                killScore: 200,
                health: 800,
                weightM: 0.6,
                speed: 0.00085,
                turnSpeed: 0.001,
                scale: 72,
                drop: ["food", 80]
            }, {
                id: 2,
                name: "Bull",
                src: "bull_2",
                hostile: true,
                dmg: 20,
                killScore: 1000,
                health: 1800,
                weightM: 0.5,
                speed: 0.00094,
                turnSpeed: 0.00074,
                scale: 78,
                viewRange: 800,
                chargePlayer: true,
                drop: ["food", 100]
            }, {
                id: 3,
                name: "Bully",
                src: "bull_1",
                hostile: true,
                dmg: 20,
                killScore: 2000,
                health: 2800,
                weightM: 0.45,
                speed: 0.001,
                turnSpeed: 0.0008,
                scale: 90,
                viewRange: 900,
                chargePlayer: true,
                drop: ["food", 400]
            }, {
                id: 4,
                name: "Wolf",
                src: "wolf_1",
                hostile: true,
                dmg: 8,
                killScore: 500,
                health: 300,
                weightM: 0.45,
                speed: 0.001,
                turnSpeed: 0.002,
                scale: 84,
                viewRange: 800,
                chargePlayer: true,
                drop: ["food", 200]
            }, {
                id: 5,
                name: "Quack",
                src: "chicken_1",
                dmg: 8,
                killScore: 2000,
                noTrap: true,
                health: 300,
                weightM: 0.2,
                speed: 0.0018,
                turnSpeed: 0.006,
                scale: 70,
                drop: ["food", 100]
            }, {
                id: 6,
                name: "MOOSTAFA",
                nameScale: 50,
                src: "enemy",
                hostile: true,
                dontRun: true,
                fixedSpawn: true,
                spawnDelay: 60000,
                noTrap: true,
                colDmg: 100,
                dmg: 40,
                killScore: 8000,
                health: 18000,
                weightM: 0.4,
                speed: 0.0007,
                turnSpeed: 0.01,
                scale: 80,
                spriteMlt: 1.8,
                leapForce: 0.9,
                viewRange: 1000,
                hitRange: 210,
                hitDelay: 1000,
                chargePlayer: true,
                drop: ["food", 100]
            }, {
                id: 7,
                name: "Treasure",
                hostile: true,
                nameScale: 35,
                src: "crate_1",
                fixedSpawn: true,
                spawnDelay: 120000,
                colDmg: 200,
                killScore: 5000,
                health: 20000,
                weightM: 0.1,
                speed: 0.0,
                turnSpeed: 0.0,
                scale: 70,
                spriteMlt: 1.0
            }, {
                id: 8,
                name: "MOOFIE",
                src: "wolf_2",
                hostile: true,
                fixedSpawn: true,
                dontRun: true,
                hitScare: 4,
                spawnDelay: 30000,
                noTrap: true,
                nameScale: 35,
                dmg: 10,
                colDmg: 100,
                killScore: 3000,
                health: 7000,
                weightM: 0.45,
                speed: 0.0015,
                turnSpeed: 0.002,
                scale: 90,
                viewRange: 800,
                chargePlayer: true,
                drop: ["food", 1000]
            }, {
                id: 9,
                name: "??MOOFIE",
                src: "wolf_2",
                hostile: !0,
                fixedSpawn: !0,
                dontRun: !0,
                hitScare: 50,
                spawnDelay: 6e4,
                noTrap: !0,
                nameScale: 35,
                dmg: 12,
                colDmg: 100,
                killScore: 3e3,
                health: 9e3,
                weightM: .45,
                speed: .0015,
                turnSpeed: .0025,
                scale: 94,
                viewRange: 1440,
                chargePlayer: !0,
                drop: ["food", 3e3],
                minSpawnRange: .85,
                maxSpawnRange: .9
            }, {
                id: 10,
                name: "??Wolf",
                src: "wolf_1",
                hostile: !0,
                fixedSpawn: !0,
                dontRun: !0,
                hitScare: 50,
                spawnDelay: 3e4,
                dmg: 10,
                killScore: 700,
                health: 500,
                weightM: .45,
                speed: .00115,
                turnSpeed: .0025,
                scale: 88,
                viewRange: 1440,
                chargePlayer: !0,
                drop: ["food", 400],
                minSpawnRange: .85,
                maxSpawnRange: .9
            }, {
                id: 11,
                name: "??Bully",
                src: "bull_1",
                hostile: !0,
                fixedSpawn: !0,
                dontRun: !0,
                hitScare: 50,
                dmg: 20,
                killScore: 5e3,
                health: 5e3,
                spawnDelay: 1e5,
                weightM: .45,
                speed: .00115,
                turnSpeed: .0025,
                scale: 94,
                viewRange: 1440,
                chargePlayer: !0,
                drop: ["food", 800],
                minSpawnRange: .85,
                maxSpawnRange: .9
            }];

            // SPAWN AI:
            this.spawn = function (x, y, dir, index) {
                var tmpObj;
                for (var i = 0; i < ais.length; ++i) {
                    if (!ais[i].active) {
                        tmpObj = ais[i];
                        break;
                    }
                }
                if (!tmpObj) {
                    tmpObj = new AI(ais.length, objectManager, players, items, UTILS, config, scoreCallback, server);
                    ais.push(tmpObj);
                }
                tmpObj.init(x, y, dir, index, this.aiTypes[index]);
                return tmpObj;
            };

        };


        /***/
    }),

    /***/ "./src/js/data/gameObject.js":
    /*!***********************************!*\
  !*** ./src/js/data/gameObject.js ***!
  \***********************************/
    /*! no static exports found */
    /***/ (function (module, exports) {

        module.exports = function (sid) {
            this.sid = sid;

            // INIT:
            this.init = function (x, y, dir, scale, type, data, owner) {
                data = data || {};
                this.sentTo = {};
                this.gridLocations = [];
                this.active = true;
                this.doUpdate = data.doUpdate;
                this.x = x;
                this.y = y;
                this.dir = dir;
                this.xWiggle = 0;
                this.yWiggle = 0;
                this.scale = scale;
                this.type = type;
                this.id = data.id;
                this.owner = owner;
                this.name = data.name;
                this.isItem = (this.id != undefined);
                this.group = data.group;
                this.health = data.health;
                this.maxHealth = data.health;
                this.layer = 2;
                if (this.group != undefined) {
                    this.layer = this.group.layer;
                } else if (this.type == 0) {
                    this.layer = 3;
                } else if (this.type == 2) {
                    this.layer = 0;
                } else if (this.type == 4) {
                    this.layer = -1;
                }
                this.colDiv = data.colDiv || 1;
                this.blocker = data.blocker;
                this.ignoreCollision = data.ignoreCollision;
                this.dontGather = data.dontGather;
                this.hideFromEnemy = data.hideFromEnemy;
                this.friction = data.friction;
                this.projDmg = data.projDmg;
                this.dmg = data.dmg;
                this.pDmg = data.pDmg;
                this.pps = data.pps;
                this.zIndex = data.zIndex || 0;
                this.turnSpeed = data.turnSpeed;
                this.req = data.req;
                this.trap = data.trap;
                this.healCol = data.healCol;
                this.teleport = data.teleport;
                this.boostSpeed = data.boostSpeed;
                this.projectile = data.projectile;
                this.shootRange = data.shootRange;
                this.shootRate = data.shootRate;
                this.shootCount = this.shootRate;
                this.spawnPoint = data.spawnPoint;
            };

            // GET HIT:
            this.changeHealth = function (amount, doer) {
                this.health += amount;
                return (this.health <= 0);
            };

            // GET SCALE:
            this.getScale = function (sM, ig) {
                sM = sM || 1;
                return this.scale * ((this.isItem || this.type == 2 || this.type == 3 || this.type == 4)
                                     ? 1 : (0.6 * sM)) * (ig ? 1 : this.colDiv);
            };

            // VISIBLE TO PLAYER:
            this.visibleToPlayer = function (player) {
                return !(this.hideFromEnemy) || (this.owner && (this.owner == player ||
                                                                (this.owner.team && player.team == this.owner.team)));
            };

            // UPDATE:
            this.update = function (delta) {
                if (this.active) {
                    if (this.xWiggle) {
                        this.xWiggle *= Math.pow(0.99, delta);
                    }
                    if (this.yWiggle) {
                        this.yWiggle *= Math.pow(0.99, delta);
                    }
                    if (this.turnSpeed && window.vars) {
                        const isSpike = this.id > 5 && this.id < 10;
                        const isMill = this.id > 9 && this.id < 13;
                        if ((isSpike && window.vars.spikeRotation) || (isMill && window.vars.millRotation)) {
                            this.dir += this.turnSpeed * delta;
                        }
                    }
                }
            };
        };


        /***/
    }),

    /***/ "./src/js/data/items.js":
    /*!******************************!*\
  !*** ./src/js/data/items.js ***!
  \******************************/
    /*! no static exports found */
    /***/ (function (module, exports) {


        // ITEM GROUPS:
        module.exports.groups = [{
            id: 0,
            name: "food",
            layer: 0
        }, {
            id: 1,
            name: "walls",
            place: !0,
            limit: 30,
            layer: 0
        }, {
            id: 2,
            name: "spikes",
            place: !0,
            limit: 15,
            layer: 0
        }, {
            id: 3,
            name: "mill",
            place: !0,
            limit: 7,
            sandboxLimit: 299,
            layer: 1
        }, {
            id: 4,
            name: "mine",
            place: !0,
            limit: 1,
            layer: 0
        }, {
            id: 5,
            name: "trap",
            place: !0,
            limit: 6,
            layer: -1
        }, {
            id: 6,
            name: "booster",
            place: !0,
            limit: 12,
            sandboxLimit: 299,
            layer: -1
        }, {
            id: 7,
            name: "turret",
            place: !0,
            limit: 2,
            layer: 1
        }, {
            id: 8,
            name: "watchtower",
            place: !0,
            limit: 12,
            layer: 1
        }, {
            id: 9,
            name: "buff",
            place: !0,
            limit: 4,
            layer: -1
        }, {
            id: 10,
            name: "spawn",
            place: !0,
            limit: 1,
            layer: -1
        }, {
            id: 11,
            name: "sapling",
            place: !0,
            limit: 2,
            layer: 0
        }, {
            id: 12,
            name: "blocker",
            place: !0,
            limit: 3,
            layer: -1
        }, {
            id: 13,
            name: "teleporter",
            place: !0,
            limit: 2,
            sandboxLimit: 299,
            layer: -1
        }];

        // PROJECTILES:
        exports.projectiles = [{
            indx: 0,
            layer: 0,
            src: "arrow_1",
            dmg: 25,
            speed: 1.6,
            scale: 103,
            range: 1000
        }, {
            indx: 1,
            layer: 1,
            dmg: 25,
            scale: 20
        }, {
            indx: 0,
            layer: 0,
            src: "arrow_1",
            dmg: 35,
            speed: 2.5,
            scale: 103,
            range: 1200
        }, {
            indx: 0,
            layer: 0,
            src: "arrow_1",
            dmg: 30,
            speed: 2,
            scale: 103,
            range: 1200
        }, {
            indx: 1,
            layer: 1,
            dmg: 16,
            scale: 20
        }, {
            indx: 0,
            layer: 0,
            src: "bullet_1",
            dmg: 50,
            speed: 3.6,
            scale: 160,
            range: 1400
        }];

        // WEAPONS:
        exports.weapons = [{
            id: 0,
            type: 0,
            name: "tool hammer",
            desc: "tool for gathering all resources",
            src: "hammer_1",
            length: 140,
            width: 140,
            xOff: -3,
            yOff: 18,
            dmg: 25,
            range: 65,
            gather: 1,
            speed: 300
        }, {
            id: 1,
            type: 0,
            age: 2,
            name: "hand axe",
            desc: "gathers resources at a higher rate",
            src: "axe_1",
            length: 140,
            width: 140,
            xOff: 3,
            yOff: 24,
            dmg: 30,
            spdMult: 1,
            range: 70,
            gather: 2,
            speed: 400
        }, {
            id: 2,
            type: 0,
            age: 8,
            pre: 1,
            name: "great axe",
            desc: "deal more damage and gather more resources",
            src: "great_axe_1",
            length: 140,
            width: 140,
            xOff: -8,
            yOff: 25,
            dmg: 35,
            spdMult: 1,
            range: 75,
            gather: 4,
            speed: 400
        }, {
            id: 3,
            type: 0,
            age: 2,
            name: "short sword",
            desc: "increased attack power but slower move speed",
            src: "sword_1",
            iPad: 1.3,
            length: 130,
            width: 210,
            xOff: -8,
            yOff: 46,
            dmg: 35,
            spdMult: 0.85,
            range: 110,
            gather: 1,
            speed: 300
        }, {
            id: 4,
            type: 0,
            age: 8,
            pre: 3,
            name: "katana",
            desc: "greater range and damage",
            src: "samurai_1",
            iPad: 1.3,
            length: 130,
            width: 210,
            xOff: -8,
            yOff: 59,
            dmg: 40,
            spdMult: 0.8,
            range: 118,
            gather: 1,
            speed: 300
        }, {
            id: 5,
            type: 0,
            age: 2,
            name: "polearm",
            desc: "long range melee weapon",
            src: "spear_1",
            iPad: 1.3,
            length: 130,
            width: 210,
            xOff: -8,
            yOff: 53,
            dmg: 45,
            knock: 0.2,
            spdMult: 0.82,
            range: 142,
            gather: 1,
            speed: 700
        }, {
            id: 6,
            type: 0,
            age: 2,
            name: "bat",
            desc: "fast long range melee weapon",
            src: "bat_1",
            iPad: 1.3,
            length: 110,
            width: 180,
            xOff: -8,
            yOff: 53,
            dmg: 20,
            knock: 0.7,
            range: 110,
            gather: 1,
            speed: 300
        }, {
            id: 7,
            type: 0,
            age: 2,
            name: "daggers",
            desc: "really fast short range weapon",
            src: "dagger_1",
            iPad: 0.8,
            length: 110,
            width: 110,
            xOff: 18,
            yOff: 0,
            dmg: 20,
            knock: 0.1,
            range: 65,
            gather: 1,
            hitSlow: 0.1,
            spdMult: 1.13,
            speed: 100
        }, {
            id: 8,
            type: 0,
            age: 2,
            name: "stick",
            desc: "great for gathering but very weak",
            src: "stick_1",
            length: 140,
            width: 140,
            xOff: 3,
            yOff: 24,
            dmg: 1,
            spdMult: 1,
            range: 70,
            gather: 7,
            speed: 400
        }, {
            id: 9,
            type: 1,
            age: 6,
            name: "hunting bow",
            desc: "bow used for ranged combat and hunting",
            src: "bow_1",
            req: ["wood", 4],
            length: 120,
            width: 120,
            xOff: -6,
            yOff: 0,
            projectile: 0,
            spdMult: 0.75,
            speed: 600
        }, {
            id: 10,
            type: 1,
            age: 6,
            name: "great hammer",
            desc: "hammer used for destroying structures",
            src: "great_hammer_1",
            length: 140,
            width: 140,
            xOff: -9,
            yOff: 25,
            dmg: 10,
            spdMult: 0.88,
            range: 75,
            sDmg: 7.5,
            gather: 1,
            speed: 400
        }, {
            id: 11,
            type: 1,
            age: 6,
            name: "wooden shield",
            desc: "blocks projectiles and reduces melee damage",
            src: "shield_1",
            length: 120,
            width: 120,
            shield: 0.2,
            xOff: 6,
            yOff: 0,
            spdMult: 0.7
        }, {
            id: 12,
            type: 1,
            age: 8,
            pre: 9,
            name: "crossbow",
            desc: "deals more damage and has greater range",
            src: "crossbow_1",
            req: ["wood", 5],
            aboveHand: true,
            armS: 0.75,
            length: 120,
            width: 120,
            xOff: -4,
            yOff: 0,
            projectile: 2,
            spdMult: 0.7,
            speed: 700
        }, {
            id: 13,
            type: 1,
            age: 9,
            pre: 12,
            name: "repeater crossbow",
            desc: "high firerate crossbow with reduced damage",
            src: "crossbow_2",
            req: ["wood", 10],
            aboveHand: true,
            armS: 0.75,
            length: 120,
            width: 120,
            xOff: -4,
            yOff: 0,
            projectile: 3,
            spdMult: 0.7,
            speed: 230
        }, {
            id: 14,
            type: 1,
            age: 6,
            name: "mc grabby",
            desc: "steals resources from enemies",
            src: "grab_1",
            length: 130,
            width: 210,
            xOff: -8,
            yOff: 53,
            dmg: 0,
            steal: 250,
            knock: 0.2,
            spdMult: 1.05,
            range: 125,
            gather: 0,
            speed: 700
        }, {
            id: 15,
            type: 1,
            age: 9,
            pre: 12,
            name: "musket",
            desc: "slow firerate but high damage and range",
            src: "musket_1",
            req: ["stone", 10],
            aboveHand: true,
            rec: 0.35,
            armS: 0.6,
            hndS: 0.3,
            hndD: 1.6,
            length: 205,
            width: 205,
            xOff: 25,
            yOff: 0,
            projectile: 5,
            hideProjectile: true,
            spdMult: 0.6,
            speed: 1500
        }];

        // ITEMS:
        module.exports.list = [{
            group: module.exports.groups[0],
            name: "apple",
            desc: "restores 20 health when consumed",
            req: ["food", 10],
            consume: function (doer) {
                return doer.changeHealth(20, doer);
            },
            heal: 20,
            scale: 22,
            holdOffset: 15
        }, {
            age: 3,
            group: module.exports.groups[0],
            name: "cookie",
            desc: "restores 40 health when consumed",
            req: ["food", 15],
            consume: function (doer) {
                return doer.changeHealth(40, doer);
            },
            heal: 40,
            scale: 27,
            holdOffset: 15
        }, {
            age: 7,
            group: module.exports.groups[0],
            name: "cheese",
            desc: "restores 30 health and another 50 over 5 seconds",
            req: ["food", 25],
            consume: function (doer) {
                if (doer.changeHealth(30, doer) || doer.health < 100) {
                    doer.dmgOverTime.dmg = -10;
                    doer.dmgOverTime.doer = doer;
                    doer.dmgOverTime.time = 5;
                    return true;
                }
                return false;
            },
            heal: 30,
            scale: 27,
            holdOffset: 15
        }, {
            group: module.exports.groups[1],
            name: "wood wall",
            desc: "provides protection for your village",
            req: ["wood", 10],
            projDmg: true,
            health: 380,
            scale: 50,
            holdOffset: 20,
            placeOffset: -5
        }, {
            age: 3,
            group: module.exports.groups[1],
            name: "stone wall",
            desc: "provides improved protection for your village",
            req: ["stone", 25],
            health: 900,
            scale: 50,
            holdOffset: 20,
            placeOffset: -5
        }, {
            age: 7,
            group: module.exports.groups[1],
            name: "castle wall",
            desc: "provides powerful protection for your village",
            req: ["stone", 35],
            health: 1500,
            scale: 52,
            holdOffset: 20,
            placeOffset: -5
        }, {
            group: module.exports.groups[2],
            name: "spikes",
            desc: "damages enemies when they touch them",
            req: ["wood", 20, "stone", 5],
            health: 400,
            dmg: 20,
            scale: 49,
            spritePadding: -23,
            holdOffset: 8,
            placeOffset: -5
        }, {
            age: 5,
            group: module.exports.groups[2],
            name: "greater spikes",
            desc: "damages enemies when they touch them",
            req: ["wood", 30, "stone", 10],
            health: 500,
            dmg: 35,
            scale: 52,
            spritePadding: -23,
            holdOffset: 8,
            placeOffset: -5
        }, {
            age: 9,
            group: module.exports.groups[2],
            name: "poison spikes",
            desc: "poisons enemies when they touch them",
            req: ["wood", 35, "stone", 15],
            health: 600,
            dmg: 30,
            pDmg: 5,
            scale: 52,
            spritePadding: -23,
            holdOffset: 8,
            placeOffset: -5
        }, {
            age: 9,
            group: module.exports.groups[2],
            name: "spinning spikes",
            desc: "damages enemies when they touch them",
            req: ["wood", 30, "stone", 20],
            health: 500,
            dmg: 45,
            turnSpeed: 0.0006,
            scale: 52,
            spritePadding: -23,
            holdOffset: 8,
            placeOffset: -5
        }, {
            group: module.exports.groups[3],
            name: "windmill",
            desc: "generates gold over time",
            req: ["wood", 50, "stone", 10],
            health: 400,
            pps: 1,
            turnSpeed: 0.0016,
            spritePadding: 25,
            iconLineMult: 12,
            scale: 45,
            holdOffset: 20,
            placeOffset: 5
        }, {
            age: 5,
            group: module.exports.groups[3],
            name: "faster windmill",
            desc: "generates more gold over time",
            req: ["wood", 60, "stone", 20],
            health: 500,
            pps: 1.5,
            turnSpeed: 0.0025,
            spritePadding: 25,
            iconLineMult: 12,
            scale: 47,
            holdOffset: 20,
            placeOffset: 5
        }, {
            age: 8,
            group: module.exports.groups[3],
            name: "power mill",
            desc: "generates more gold over time",
            req: ["wood", 100, "stone", 50],
            health: 800,
            pps: 2,
            turnSpeed: 0.005,
            spritePadding: 25,
            iconLineMult: 12,
            scale: 47,
            holdOffset: 20,
            placeOffset: 5
        }, {
            age: 5,
            group: module.exports.groups[4],
            type: 2,
            name: "mine",
            desc: "allows you to mine stone",
            req: ["wood", 20, "stone", 100],
            iconLineMult: 12,
            scale: 65,
            holdOffset: 20,
            placeOffset: 0
        }, {
            age: 5,
            group: module.exports.groups[11],
            type: 0,
            name: "sapling",
            desc: "allows you to farm wood",
            req: ["wood", 150],
            iconLineMult: 12,
            colDiv: 0.5,
            scale: 110,
            holdOffset: 50,
            placeOffset: -15
        }, {
            age: 4,
            group: module.exports.groups[5],
            name: "pit trap",
            desc: "pit that traps enemies if they walk over it",
            req: ["wood", 30, "stone", 30],
            trap: true,
            ignoreCollision: true,
            hideFromEnemy: true,
            health: 500,
            colDiv: 0.2,
            scale: 50,
            holdOffset: 20,
            placeOffset: -5
        }, {
            age: 4,
            group: module.exports.groups[6],
            name: "boost pad",
            desc: "provides boost when stepped on",
            req: ["stone", 20, "wood", 5],
            ignoreCollision: true,
            boostSpeed: 1.5,
            health: 150,
            colDiv: 0.7,
            scale: 45,
            holdOffset: 20,
            placeOffset: -5
        }, {
            age: 7,
            group: module.exports.groups[7],
            doUpdate: true,
            name: "turret",
            desc: "defensive structure that shoots at enemies",
            req: ["wood", 200, "stone", 150],
            health: 800,
            projectile: 1,
            shootRange: 700,
            shootRate: 2200,
            scale: 43,
            holdOffset: 20,
            placeOffset: -5
        }, {
            age: 7,
            group: module.exports.groups[8],
            name: "platform",
            desc: "platform to shoot over walls and cross over water",
            req: ["wood", 20],
            ignoreCollision: true,
            zIndex: 1,
            health: 300,
            scale: 43,
            holdOffset: 20,
            placeOffset: -5
        }, {
            age: 7,
            group: module.exports.groups[9],
            name: "healing pad",
            desc: "standing on it will slowly heal you",
            req: ["wood", 30, "food", 10],
            ignoreCollision: true,
            healCol: 15,
            health: 400,
            colDiv: 0.7,
            scale: 45,
            holdOffset: 20,
            placeOffset: -5
        }, {
            age: 9,
            group: module.exports.groups[10],
            name: "spawn pad",
            desc: "you will spawn here when you die but it will dissapear",
            req: ["wood", 100, "stone", 100],
            health: 400,
            ignoreCollision: true,
            spawnPoint: true,
            scale: 45,
            holdOffset: 20,
            placeOffset: -5
        }, {
            age: 7,
            group: module.exports.groups[12],
            name: "blocker",
            desc: "blocks building in radius",
            req: ["wood", 30, "stone", 25],
            ignoreCollision: true,
            blocker: 300,
            health: 400,
            colDiv: 0.7,
            scale: 45,
            holdOffset: 20,
            placeOffset: -5
        }, {
            age: 7,
            group: module.exports.groups[13],
            name: "teleporter",
            desc: "teleports you to a random point on the map",
            req: ["wood", 60, "stone", 60],
            ignoreCollision: true,
            teleport: true,
            health: 200,
            colDiv: 0.7,
            scale: 45,
            holdOffset: 20,
            placeOffset: -5
        }];

        // ASSIGN IDS:
        for (var i = 0; i < module.exports.list.length; ++i) {
            module.exports.list[i].id = i;
        }

        // TROLOLOLOL:
        if (typeof window !== "undefined") {
            function shuffle(a) {
                for (let i = a.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [a[i], a[j]] = [a[j], a[i]];
                }
                return a;
            }
        }


        /***/
    }),

    /***/ "./src/js/data/mapManager.js":
    /*!***********************************!*\
  !*** ./src/js/data/mapManager.js ***!
  \***********************************/
    /*! no static exports found */
    /***/ (function (module, exports) {

        // GLOBAL MAPMANAGER:
        module.exports = {}

        /***/
    }),

    /***/ "./src/js/data/objectManager.js":
    /*!**************************************!*\
  !*** ./src/js/data/objectManager.js ***!
  \**************************************/
    /*! no static exports found */
    /***/ (function (module, exports) {

        var mathFloor = Math.floor;
        var mathABS = Math.abs;
        var mathCOS = Math.cos;
        var mathSIN = Math.sin;
        var mathPOW = Math.pow;
        var mathSQRT = Math.sqrt;
        module.exports = function (GameObject, gameObjects, UTILS, config, players, server) {
            this.objects = gameObjects;
            this.grids = {};
            this.updateObjects = [];

            // SET OBJECT GRIDS:
            var tmpX, tmpY;
            var tmpS = config.mapScale / config.colGrid;
            this.setObjectGrids = function (obj) {
                var objX = Math.min(config.mapScale, Math.max(0, obj.x));
                var objY = Math.min(config.mapScale, Math.max(0, obj.y));
                for (var x = 0; x < config.colGrid; ++x) {
                    tmpX = x * tmpS;
                    for (var y = 0; y < config.colGrid; ++y) {
                        tmpY = y * tmpS;
                        if (objX + obj.scale >= tmpX && objX - obj.scale <= tmpX + tmpS &&
                            objY + obj.scale >= tmpY && objY - obj.scale <= tmpY + tmpS) {
                            if (!this.grids[x + "_" + y])
                                this.grids[x + "_" + y] = [];
                            this.grids[x + "_" + y].push(obj);
                            obj.gridLocations.push(x + "_" + y);
                        }
                    }
                }
            };

            // REMOVE OBJECT FROM GRID:
            this.removeObjGrid = function (obj) {
                var tmpIndx;
                for (var i = 0; i < obj.gridLocations.length; ++i) {
                    tmpIndx = this.grids[obj.gridLocations[i]].indexOf(obj);
                    if (tmpIndx >= 0) {
                        this.grids[obj.gridLocations[i]].splice(tmpIndx, 1);
                    }
                }
            };

            // DISABLE OBJ:
            this.disableObj = function (obj) {
                obj.active = false;
                if (server) {
                    if (obj.owner && obj.pps) obj.owner.pps -= obj.pps;
                    this.removeObjGrid(obj);
                    var tmpIndx = this.updateObjects.indexOf(obj);
                    if (tmpIndx >= 0) {
                        this.updateObjects.splice(tmpIndx, 1);
                    }
                }
            };

            // HIT OBJECT:
            this.hitObj = function (tmpObj, tmpDir) {
                for (var p = 0; p < players.length; ++p) {
                    if (players[p].active) {
                        if (tmpObj.sentTo[players[p].id]) {
                            if (!tmpObj.active) server.send(players[p].id, "Q", tmpObj.sid);
                            else if (players[p].canSee(tmpObj))
                                server.send(players[p].id, "L", UTILS.fixTo(tmpDir, 1), tmpObj.sid);
                        } if (!tmpObj.active && tmpObj.owner == players[p])
                            players[p].changeItemCount(tmpObj.group.id, -1);
                    }
                }
            };

            // GET GRID ARRAY:
            var tmpArray = [];
            var tmpGrid;
            this.getGridArrays = function (xPos, yPos, s) {
                tmpX = mathFloor(xPos / tmpS);
                tmpY = mathFloor(yPos / tmpS);
                tmpArray.length = 0;
                try {
                    if (this.grids[tmpX + "_" + tmpY])
                        tmpArray.push(this.grids[tmpX + "_" + tmpY]);
                    if (xPos + s >= (tmpX + 1) * tmpS) { // RIGHT
                        tmpGrid = this.grids[(tmpX + 1) + "_" + tmpY];
                        if (tmpGrid) tmpArray.push(tmpGrid);
                        if (tmpY && yPos - s <= tmpY * tmpS) { // TOP RIGHT
                            tmpGrid = this.grids[(tmpX + 1) + "_" + (tmpY - 1)];
                            if (tmpGrid) tmpArray.push(tmpGrid);
                        } else if (yPos + s >= (tmpY + 1) * tmpS) { // BOTTOM RIGHT
                            tmpGrid = this.grids[(tmpX + 1) + "_" + (tmpY + 1)];
                            if (tmpGrid) tmpArray.push(tmpGrid);
                        }
                    } if (tmpX && xPos - s <= tmpX * tmpS) { // LEFT
                        tmpGrid = this.grids[(tmpX - 1) + "_" + tmpY];
                        if (tmpGrid) tmpArray.push(tmpGrid);
                        if (tmpY && yPos - s <= tmpY * tmpS) { // TOP LEFT
                            tmpGrid = this.grids[(tmpX - 1) + "_" + (tmpY - 1)];
                            if (tmpGrid) tmpArray.push(tmpGrid);
                        } else if (yPos + s >= (tmpY + 1) * tmpS) { // BOTTOM LEFT
                            tmpGrid = this.grids[(tmpX - 1) + "_" + (tmpY + 1)];
                            if (tmpGrid) tmpArray.push(tmpGrid);
                        }
                    } if (yPos + s >= (tmpY + 1) * tmpS) { // BOTTOM
                        tmpGrid = this.grids[tmpX + "_" + (tmpY + 1)];
                        if (tmpGrid) tmpArray.push(tmpGrid);
                    } if (tmpY && yPos - s <= tmpY * tmpS) { // TOP
                        tmpGrid = this.grids[tmpX + "_" + (tmpY - 1)];
                        if (tmpGrid) tmpArray.push(tmpGrid);
                    }
                } catch (e) { }
                return tmpArray;
            };

            // ADD NEW:
            var tmpObj;
            this.add = function (sid, x, y, dir, s, type, data, setSID, owner) {
                tmpObj = null;
                for (var i = 0; i < gameObjects.length; ++i) {
                    if (gameObjects[i].sid == sid) {
                        tmpObj = gameObjects[i];
                        break;
                    }
                } if (!tmpObj) {
                    for (var i = 0; i < gameObjects.length; ++i) {
                        if (!gameObjects[i].active) {
                            tmpObj = gameObjects[i];
                            break;
                        }
                    }
                } if (!tmpObj) {
                    tmpObj = new GameObject(sid);
                    gameObjects.push(tmpObj);
                }
                if (setSID)
                    tmpObj.sid = sid;
                tmpObj.init(x, y, dir, s, type, data, owner);
                if (server) {
                    this.setObjectGrids(tmpObj);
                    if (tmpObj.doUpdate)
                        this.updateObjects.push(tmpObj);
                }
            };

            // DISABLE BY SID:
            this.disableBySid = function (sid) {
                for (const object of gameObjects) {
                    if (object.sid != sid) continue;

                    gameObjects.splice(gameObjects.indexOf(object), 1);
                    break;
                }

                /*
                    for(var i = 0; i < gameObjects.length; ++i){
                        if(gameObjects[i].sid == sid){
                            this.disableObj(gameObjects[i]);
                            break;
                        }
                    }
                    */
            };

            // REMOVE ALL FROM PLAYER:
            this.removeAllItems = function (sid, server) {
                const objects = gameObjects.filter((object) => object.owner && object.owner.sid == sid);
                for (const object of objects) {
                    gameObjects.splice(gameObjects.indexOf(object), 1);
                }

                /*
                    for (var i = 0; i < gameObjects.length; ++i) {
                        if (gameObjects[i].active && gameObjects[i].owner && gameObjects[i].owner.sid == sid) {
                            this.disableObj(gameObjects[i]);
                        }
                    }
                    if (server) {
                        server.broadcast("R", sid);
                    }
                    */
            };

            // FETCH SPAWN OBJECT:
            this.fetchSpawnObj = function (sid) {
                var tmpLoc = null;
                for (var i = 0; i < gameObjects.length; ++i) {
                    tmpObj = gameObjects[i];
                    if (tmpObj.active && tmpObj.owner && tmpObj.owner.sid == sid && tmpObj.spawnPoint) {
                        tmpLoc = [tmpObj.x, tmpObj.y];
                        this.disableObj(tmpObj);
                        server.broadcast("Q", tmpObj.sid);
                        if (tmpObj.owner) {
                            tmpObj.owner.changeItemCount(tmpObj.group.id, -1);
                        }
                        break;
                    }
                }
                return tmpLoc;
            };

            // CHECK IF PLACABLE:
            this.checkItemLocation = function (x, y, s, sM, indx, ignoreWater, placer, objects) {
                for (var i = 0; i < objects.length; ++i) {
                    var blockS = (objects[i].blocker ?
                                  objects[i].blocker : objects[i].getScale(sM, objects[i].isItem));
                    if (objects[i].active && UTILS.getDistance(x, y, objects[i].x,
                                                               objects[i].y) < (s + blockS))
                        return false;
                } if (!ignoreWater && indx != 18 && y >= (config.mapScale / 2) - (config.riverWidth / 2) && y <=
                      (config.mapScale / 2) + (config.riverWidth / 2)) {
                    return false;
                }
                return true;
            };

            // ADD PROJECTILE:
            this.addProjectile = function (x, y, dir, range, indx) {
                var tmpData = items.projectiles[indx];
                var tmpProj;
                for (var i = 0; i < projectiles.length; ++i) {
                    if (!projectiles[i].active) {
                        tmpProj = projectiles[i];
                        break;
                    }
                }
                if (!tmpProj) {
                    tmpProj = new Projectile(players, UTILS);
                    projectiles.push(tmpProj);
                }
                tmpProj.init(indx, x, y, dir, tmpData.speed, range, tmpData.scale);
            };

            // CHECK PLAYER COLLISION:
            this.checkCollision = function (player, other, delta) {
                delta = delta || 1;
                var dx = player.x - other.x;
                var dy = player.y - other.y;
                var tmpLen = player.scale + other.scale;
                if (mathABS(dx) <= tmpLen || mathABS(dy) <= tmpLen) {
                    tmpLen = player.scale + (other.getScale ? other.getScale() : other.scale);
                    var tmpInt = mathSQRT(dx * dx + dy * dy) - tmpLen;
                    if (tmpInt <= 0) {
                        if (!other.ignoreCollision) {
                            var tmpDir = UTILS.getDirection(player.x, player.y, other.x, other.y);
                            var tmpDist = UTILS.getDistance(player.x, player.y, other.x, other.y);
                            if (other.isPlayer) {
                                tmpInt = (tmpInt * -1) / 2;
                                player.x += (tmpInt * mathCOS(tmpDir));
                                player.y += (tmpInt * mathSIN(tmpDir));
                                other.x -= (tmpInt * mathCOS(tmpDir));
                                other.y -= (tmpInt * mathSIN(tmpDir));
                            } else {
                                player.x = other.x + (tmpLen * mathCOS(tmpDir));
                                player.y = other.y + (tmpLen * mathSIN(tmpDir));
                                player.xVel *= 0.75;
                                player.yVel *= 0.75;
                            }
                            if (other.dmg && other.owner != player && !(other.owner &&
                                                                        other.owner.team && other.owner.team == player.team)) {
                                player.changeHealth(-other.dmg, other.owner, other);
                                var tmpSpd = 1.5 * (other.weightM || 1);
                                player.xVel += tmpSpd * mathCOS(tmpDir);
                                player.yVel += tmpSpd * mathSIN(tmpDir);
                                if (other.pDmg && !(player.skin && player.skin.poisonRes)) {
                                    player.dmgOverTime.dmg = other.pDmg;
                                    player.dmgOverTime.time = 5;
                                    player.dmgOverTime.doer = other.owner;
                                }
                                if (player.colDmg && other.health) {
                                    if (other.changeHealth(-player.colDmg)) this.disableObj(other);
                                    this.hitObj(other, UTILS.getDirection(player.x, player.y, other.x, other.y));
                                }
                            }
                        } else if (other.trap && !player.noTrap && other.owner != player && !(other.owner &&
                                                                                              other.owner.team && other.owner.team == player.team)) {
                            player.lockMove = true;
                            other.hideFromEnemy = false;
                        } else if (other.boostSpeed) {
                            player.xVel += (delta * other.boostSpeed * (other.weightM || 1)) * mathCOS(other.dir);
                            player.yVel += (delta * other.boostSpeed * (other.weightM || 1)) * mathSIN(other.dir);
                        } else if (other.healCol) {
                            player.healCol = other.healCol;
                        } else if (other.teleport) {
                            player.x = UTILS.randInt(0, config.mapScale);
                            player.y = UTILS.randInt(0, config.mapScale);
                        }
                        if (other.zIndex > player.zIndex) player.zIndex = other.zIndex;
                        return true;
                    }
                }
                return false;
            };

        };


        /***/
    }),

    /***/ "./src/js/data/player.js":
    /*!*******************************!*\
  !*** ./src/js/data/player.js ***!
  \*******************************/
    /*! no static exports found */
    /***/ (function (module, exports, __webpack_require__) {

        var LangFilter = __webpack_require__(/*! bad-words */ "./node_modules/bad-words/lib/badwords.js");
        var langFilter = new LangFilter();
        var newProfane = ['jew', 'black', 'baby', 'child', 'white',
                          'porn', 'pedo', 'trump', 'clinton', 'hitler', 'nazi',
                          'gay', 'pride', 'sex', 'pleasure', 'touch', 'poo', 'kids',
                          'rape', 'white power', 'nigga', 'nig nog', 'doggy', 'rapist',
                          'boner', 'nigger', 'nigg', 'finger', 'nogger', 'nagger', 'nig',
                          'fag', 'gai', 'pole', 'stripper', "penis", 'vagina', 'pussy',
                          'nazi', 'hitler', 'stalin', 'burn', 'chamber', 'cock',
                          'peen', 'dick', 'spick', 'nieger', 'die', 'satan', 'n|ig', 'nlg',
                          'cunt', 'c0ck', 'fag', 'lick', 'condom', 'anal', 'shit', 'phile',
                          'little', 'kids', 'free KR', 'tiny', 'sidney', 'ass', 'kill', '.io',
                          '(dot)', '[dot]', 'mini', 'whiore', 'whore', 'faggot', 'github',
                          '1337', '666', 'satan',
                          'senpa', 'discord', 'd1scord', 'mistik', '.io', 'senpa.io', 'sidney', 'sid', 'senpaio', 'vries', 'asa',
                         ];
        langFilter.addWords(...newProfane);

        var mathABS = Math.abs;
        var mathCOS = Math.cos;
        var mathSIN = Math.sin;
        var mathPOW = Math.pow;
        var mathSQRT = Math.sqrt;
        module.exports = function (id, sid, config, UTILS, projectileManager,
                                    objectManager, players, ais, items, hats, accessories, server, scoreCallback, iconCallback) {
            this.id = id;
            this.sid = sid;
            this.tmpScore = 0;
            this.team = null;
            this.skinIndex = 0;
            this.tailIndex = 0;
            this.hitTime = 0;
            this.tails = {};
            for (var i = 0; i < accessories.length; ++i) {
                if (accessories[i].price <= 0)
                    this.tails[accessories[i].id] = 1;
            }
            this.skins = {};
            for (var i = 0; i < hats.length; ++i) {
                if (hats[i].price <= 0)
                    this.skins[hats[i].id] = 1;
            }
            this.points = 0;
            this.dt = 0;
            this.hidden = false;
            this.itemCounts = {};
            this.isPlayer = true;
            this.pps = 0;
            this.moveDir = undefined;
            this.skinRot = 0;
            this.lastPing = 0;
            this.iconIndex = 0;
            this.skinColor = 0;

            // SPAWN:
            this.spawn = function (moofoll) {
                this.weaponVariants = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
                this.spikeDamage = 0;

                this.active = true;
                this.alive = true;
                this.lockMove = false;
                this.lockDir = false;
                this.chatCountdown = 0;
                this.shameCount = 0;
                this.shameTimer = 0;
                this.sentTo = {};
                this.gathering = 0;
                this.shooting = {};
                this.autoGather = 0;
                this.animTime = 0;
                this.animSpeed = 0;
                this.mouseState = 0;
                this.buildIndex = -1;
                this.weaponIndex = 0;
                this.weaponVariant = 0;
                this.dmgOverTime = {};
                this.noMovTimer = 0;
                this.maxXP = 300;
                this.XP = 0;
                this.age = 1;
                this.kills = 0;
                this.upgrAge = 2;
                this.upgradePoints = 0;
                this.x = 0;
                this.y = 0;
                this.zIndex = 0;
                this.xVel = 0;
                this.yVel = 0;
                this.slowMult = 1;
                this.dir = 0;
                this.dirPlus = 0;
                this.targetDir = 0;
                this.targetAngle = 0;
                this.maxHealth = 100;
                this.health = this.maxHealth;
                this.scale = config.playerScale;
                this.speed = config.playerSpeed;
                this.resetMoveDir();
                this.resetResources(moofoll);
                this.items = [0, 3, 6, 10];
                this.weapons = [0];
                this.shootCount = 0;
                this.weaponXP = [];
                this.reloads = {
                    [0]: 0,
                    [1]: 0,
                    [2]: 0,
                    [3]: 0,
                    [4]: 0,
                    [5]: 0,
                    [6]: 0,
                    [7]: 0,
                    [8]: 0,
                    [9]: 0,
                    [10]: 0,
                    [11]: 0,
                    [12]: 0,
                    [13]: 0,
                    [14]: 0,
                    [15]: 0,
                    [53]: 0
                };
            };

            // RESET MOVE DIR:
            this.resetMoveDir = function () {
                this.moveDir = undefined;
            };

            // RESET RESOURCES:
            this.resetResources = function (moofoll) {
                for (var i = 0; i < config.resourceTypes.length; ++i) {
                    this[config.resourceTypes[i]] = moofoll ? 100 : 0;
                }
            };

            // ADD ITEM:
            this.addItem = function (id) {
                var tmpItem = items.list[id];
                if (tmpItem) {
                    for (var i = 0; i < this.items.length; ++i) {
                        if (items.list[this.items[i]].group == tmpItem.group) {
                            if (this.buildIndex == this.items[i])
                                this.buildIndex = id;
                            this.items[i] = id;
                            return true;
                        }
                    }
                    this.items.push(id);
                    return true;
                }
                return false;
            };

            // SET USER DATA:
            this.setUserData = function (data) {
                if (data) {
                    // SET INITIAL NAME:
                    this.name = "unknown";

                    // VALIDATE NAME:
                    var name = data.name + "";
                    name = name.slice(0, config.maxNameLength);
                    name = name.replace(/[^\w:\(\)\/? -]+/gmi, " ");  // USE SPACE SO WE CAN CHECK PROFANITY
                    name = name.replace(/[^\x00-\x7F]/g, " ");
                    name = name.trim();

                    // CHECK IF IS PROFANE:
                    var isProfane = false;
                    var convertedName = name.toLowerCase().replace(/\s/g, "").replace(/1/g, "i").replace(/0/g, "o").replace(/5/g, "s");
                    for (var word of langFilter.list) {
                        if (convertedName.indexOf(word) != -1) {
                            isProfane = true;
                            break;
                        }
                    }
                    if (name.length > 0 && !isProfane) {
                        this.name = name;
                    }

                    // SKIN:
                    this.skinColor = 0;
                    if (config.skinColors[data.skin])
                        this.skinColor = data.skin;
                }
            };

            // GET DATA TO SEND:
            this.getData = function () {
                return [
                    this.id,
                    this.sid,
                    this.name,
                    UTILS.fixTo(this.x, 2),
                    UTILS.fixTo(this.y, 2),
                    UTILS.fixTo(this.dir, 3),
                    this.health,
                    this.maxHealth,
                    this.scale,
                    this.skinColor
                ];
            };

            // SET DATA:
            this.setData = function (data) {
                this.id = data[0];
                this.sid = data[1];
                this.name = data[2];
                this.x = data[3];
                this.y = data[4];
                this.dir = data[5];
                this.health = data[6];
                this.maxHealth = data[7];
                this.scale = data[8];
                this.skinColor = data[9];
            };

            // UPDATE:
            var timerCount = 0;
            this.update = function (delta) {
                if (!this.alive) return;

                // SHAME SHAME SHAME:
                if (this.shameTimer > 0) {
                    this.shameTimer -= delta;
                    if (this.shameTimer <= 0) {
                        this.shameTimer = 0;
                        this.shameCount = 0;
                    }
                }

                // REGENS AND AUTO:
                timerCount -= delta;
                if (timerCount <= 0) {
                    var regenAmount = (this.skin && this.skin.healthRegen ? this.skin.healthRegen : 0) +
                        (this.tail && this.tail.healthRegen ? this.tail.healthRegen : 0);
                    if (regenAmount) {
                        this.changeHealth(regenAmount, this);
                    } if (this.dmgOverTime.dmg) {
                        this.changeHealth(-this.dmgOverTime.dmg, this.dmgOverTime.doer);
                        this.dmgOverTime.time -= 1;
                        if (this.dmgOverTime.time <= 0)
                            this.dmgOverTime.dmg = 0;
                    } if (this.healCol) {
                        this.changeHealth(this.healCol, this);
                    }
                    timerCount = 1000;
                }

                // CHECK KILL:
                if (!this.alive)
                    return;

                // SLOWER:
                if (this.slowMult < 1) {
                    this.slowMult += 0.0008 * delta;
                    if (this.slowMult > 1)
                        this.slowMult = 1;
                }

                // MOVE:
                this.noMovTimer += delta;
                if (this.xVel || this.yVel) this.noMovTimer = 0;
                if (this.lockMove) {
                    this.xVel = 0;
                    this.yVel = 0;
                } else {
                    var spdMult = ((this.buildIndex >= 0) ? 0.5 : 1) * (items.weapons[this.weaponIndex].spdMult || 1) *
                        (this.skin ? (this.skin.spdMult || 1) : 1) * (this.tail ? (this.tail.spdMult || 1) : 1) * (this.y <= config.snowBiomeTop ?
                                                                                                                   ((this.skin && this.skin.coldM) ? 1 : config.snowSpeed) : 1) * this.slowMult;
                    if (!this.zIndex && this.y >= (config.mapScale / 2) - (config.riverWidth / 2) &&
                        this.y <= (config.mapScale / 2) + (config.riverWidth / 2)) {
                        if (this.skin && this.skin.watrImm) {
                            spdMult *= 0.75;
                            this.xVel += config.waterCurrent * 0.4 * delta;
                        } else {
                            spdMult *= 0.33;
                            this.xVel += config.waterCurrent * delta;
                        }
                    }
                    var xVel = (this.moveDir != undefined) ? mathCOS(this.moveDir) : 0;
                    var yVel = (this.moveDir != undefined) ? mathSIN(this.moveDir) : 0;
                    var length = mathSQRT(xVel * xVel + yVel * yVel);
                    if (length != 0) {
                        xVel /= length;
                        yVel /= length;
                    }
                    if (xVel) this.xVel += xVel * this.speed * spdMult * delta;
                    if (yVel) this.yVel += yVel * this.speed * spdMult * delta;
                }

                // OBJECT COLL:
                this.zIndex = 0;
                this.lockMove = false;
                this.healCol = 0;
                var tmpList;
                var tmpSpeed = UTILS.getDistance(0, 0, this.xVel * delta, this.yVel * delta);
                var depth = Math.min(4, Math.max(1, Math.round(tmpSpeed / 40)));
                var tMlt = 1 / depth;
                for (var i = 0; i < depth; ++i) {
                    if (this.xVel)
                        this.x += (this.xVel * delta) * tMlt;
                    if (this.yVel)
                        this.y += (this.yVel * delta) * tMlt;
                    tmpList = objectManager.getGridArrays(this.x, this.y, this.scale);
                    for (var x = 0; x < tmpList.length; ++x) {
                        for (var y = 0; y < tmpList[x].length; ++y) {
                            if (tmpList[x][y].active)
                                objectManager.checkCollision(this, tmpList[x][y], tMlt);
                        }
                    }
                }

                // PLAYER COLLISIONS:
                var tmpIndx = players.indexOf(this);
                for (var i = tmpIndx + 1; i < players.length; ++i) {
                    if (players[i] != this && players[i].alive)
                        objectManager.checkCollision(this, players[i]);
                }

                // DECEL:
                if (this.xVel) {
                    this.xVel *= mathPOW(config.playerDecel, delta);
                    if (this.xVel <= 0.01 && this.xVel >= -0.01) this.xVel = 0;
                } if (this.yVel) {
                    this.yVel *= mathPOW(config.playerDecel, delta);
                    if (this.yVel <= 0.01 && this.yVel >= -0.01) this.yVel = 0;
                }

                // MAP BOUNDARIES:
                if (this.x - this.scale < 0) {
                    this.x = this.scale;
                } else if (this.x + this.scale > config.mapScale) {
                    this.x = config.mapScale - this.scale;
                } if (this.y - this.scale < 0) {
                    this.y = this.scale;
                } else if (this.y + this.scale > config.mapScale) {
                    this.y = config.mapScale - this.scale;
                }

                // USE WEAPON OR TOOL:
                if (this.buildIndex < 0) {
                    if (this.reloads[this.weaponIndex] > 0) {
                        this.reloads[this.weaponIndex] -= delta;
                        this.gathering = this.mouseState;
                    } else if (this.gathering || this.autoGather) {
                        var worked = true;
                        if (items.weapons[this.weaponIndex].gather != undefined) {
                            this.gather(players);
                        } else if (items.weapons[this.weaponIndex].projectile != undefined &&
                                   this.hasRes(items.weapons[this.weaponIndex], (this.skin ? this.skin.projCost : 0))) {
                            this.useRes(items.weapons[this.weaponIndex], (this.skin ? this.skin.projCost : 0));
                            this.noMovTimer = 0;
                            var tmpIndx = items.weapons[this.weaponIndex].projectile;
                            var projOffset = this.scale * 2;
                            var aMlt = (this.skin && this.skin.aMlt) ? this.skin.aMlt : 1;
                            if (items.weapons[this.weaponIndex].rec) {
                                this.xVel -= items.weapons[this.weaponIndex].rec * mathCOS(this.dir);
                                this.yVel -= items.weapons[this.weaponIndex].rec * mathSIN(this.dir);
                            }
                            projectileManager.addProjectile(this.x + (projOffset * mathCOS(this.dir)),
                                                            this.y + (projOffset * mathSIN(this.dir)), this.dir, items.projectiles[tmpIndx].range * aMlt,
                                                            items.projectiles[tmpIndx].speed * aMlt, tmpIndx, this, null, this.zIndex);
                        } else {
                            worked = false;
                        }
                        this.gathering = this.mouseState;
                        if (worked) {
                            this.reloads[this.weaponIndex] = items.weapons[this.weaponIndex].speed * (this.skin ? (this.skin.atkSpd || 1) : 1);
                        }
                    }
                }

            };

            // ADD WEAPON XP:
            this.addWeaponXP = function (amnt) {
                if (!this.weaponXP[this.weaponIndex])
                    this.weaponXP[this.weaponIndex] = 0;
                this.weaponXP[this.weaponIndex] += amnt;
            };

            // EARN XP:
            this.earnXP = function (amount) {
                if (this.age < config.maxAge) {
                    this.XP += amount;
                    if (this.XP >= this.maxXP) {
                        if (this.age < config.maxAge) {
                            this.age++;
                            this.XP = 0;
                            this.maxXP *= 1.2;
                        } else {
                            this.XP = this.maxXP;
                        }
                        this.upgradePoints++;
                        server.send(this.id, "U", this.upgradePoints, this.upgrAge);
                        server.send(this.id, "T", this.XP, UTILS.fixTo(this.maxXP, 1), this.age);
                    } else {
                        server.send(this.id, "T", this.XP);
                    }
                }
            };

            // CHANGE HEALTH:
            this.changeHealth = function (amount, doer) {
                if (amount > 0 && this.health >= this.maxHealth)
                    return false
                if (amount < 0 && this.skin)
                    amount *= this.skin.dmgMult || 1;
                if (amount < 0 && this.tail)
                    amount *= this.tail.dmgMult || 1;
                if (amount < 0)
                    this.hitTime = Date.now();
                this.health += amount;
                if (this.health > this.maxHealth) {
                    amount -= (this.health - this.maxHealth);
                    this.health = this.maxHealth;
                }
                if (this.health <= 0)
                    this.kill(doer);
                for (var i = 0; i < players.length; ++i) {
                    if (this.sentTo[players[i].id])
                        server.send(players[i].id, "O", this.sid, Math.round(this.health));
                }
                if (doer && doer.canSee(this) && !(doer == this && amount < 0)) {
                    server.send(doer.id, "8", Math.round(this.x),
                                Math.round(this.y), Math.round(-amount), 1);
                }
                return true;
            };

            // KILL:
            this.kill = function (doer) {
                if (doer && doer.alive) {
                    doer.kills++;
                    if (doer.skin && doer.skin.goldSteal) scoreCallback(doer, Math.round(this.points / 2));
                    else scoreCallback(doer, Math.round(this.age * 100 * ((doer.skin && doer.skin.kScrM) ? doer.skin.kScrM : 1)));
                    server.send(doer.id, "N", "kills", doer.kills, 1);
                }
                this.alive = false;
                server.send(this.id, "P");
                iconCallback();
            };

            // ADD RESOURCE:
            this.addResource = function (type, amount, auto) {
                if (!auto && amount > 0)
                    this.addWeaponXP(amount);
                if (type == 3) {
                    scoreCallback(this, amount, true);
                } else {
                    this[config.resourceTypes[type]] += amount;
                    server.send(this.id, "N", config.resourceTypes[type], this[config.resourceTypes[type]], 1);
                }
            };

            // CHANGE ITEM COUNT:
            this.changeItemCount = function (index, value) {
                this.itemCounts[index] = this.itemCounts[index] || 0;
                this.itemCounts[index] += value;
                server.send(this.id, "S", index, this.itemCounts[index]);
            };

            // BUILD:
            this.buildItem = function (item) {
                var tmpS = (this.scale + item.scale + (item.placeOffset || 0));
                var tmpX = this.x + (tmpS * mathCOS(this.dir));
                var tmpY = this.y + (tmpS * mathSIN(this.dir));
                if (this.canBuild(item) && !(item.consume && (this.skin && this.skin.noEat))
                    && (item.consume || objectManager.checkItemLocation(tmpX, tmpY, item.scale,
                                                                        0.6, item.id, false, this))) {
                    var worked = false;
                    if (item.consume) {
                        if (this.hitTime) {
                            var timeSinceHit = Date.now() - this.hitTime;
                            this.hitTime = 0;
                            if (timeSinceHit <= 120) {
                                this.shameCount++;
                                if (this.shameCount > 0) this.shameAbuse = true;
                                if (this.shameCount >= 8) {
                                    this.shameTimer = 30000;
                                    this.shameCount = 0;
                                }
                            } else {
                                this.shameCount -= 2;
                                if (this.shameCount <= 0) {
                                    this.shameCount = 0;
                                }
                            }
                        }
                        if (this.shameTimer <= 0)
                            worked = item.consume(this);
                    } else {
                        worked = true;
                        if (item.group.limit) {
                            this.changeItemCount(item.group.id, 1);
                        }
                        if (item.pps)
                            this.pps += item.pps;
                        objectManager.add(objectManager.objects.length, tmpX, tmpY, this.dir, item.scale,
                                          item.type, item, false, this);
                    }
                    if (worked) {
                        this.useRes(item);
                        this.buildIndex = -1;
                    }
                }
            };

            // HAS RESOURCES:
            this.hasRes = function (item, mult) {
                for (var i = 0; i < item.req.length;) {
                    if (this[item.req[i]] < Math.round(item.req[i + 1] * (mult || 1)))
                        return false;
                    i += 2;
                }
                return true;
            };

            // USE RESOURCES:
            this.useRes = function (item, mult) {
                if (config.inSandbox)
                    return;
                for (var i = 0; i < item.req.length;) {
                    this.addResource(config.resourceTypes.indexOf(item.req[i]), -Math.round(item.req[i + 1] * (mult || 1)));
                    i += 2;
                }
            };

            // CAN BUILD:
            this.canBuild = function (item) {
                if (config.inSandbox)
                    return true;
                if (item.group.limit && this.itemCounts[item.group.id] >= item.group.limit)
                    return false;
                return this.hasRes(item);
            };

            // GATHER:
            this.gather = function () {

                // SHOW:
                this.noMovTimer = 0;

                // SLOW MOVEMENT:
                this.slowMult -= (items.weapons[this.weaponIndex].hitSlow || 0.3);
                if (this.slowMult < 0)
                    this.slowMult = 0;

                // VARIANT DMG:
                var tmpVariant = config.fetchVariant(this);
                var applyPoison = tmpVariant.poison;
                var variantDmg = tmpVariant.val;

                // CHECK IF HIT GAME OBJECT:
                var hitObjs = {};
                var tmpDist, tmpDir, tmpObj, hitSomething;
                var tmpList = objectManager.getGridArrays(this.x, this.y, items.weapons[this.weaponIndex].range);
                for (var t = 0; t < tmpList.length; ++t) {
                    for (var i = 0; i < tmpList[t].length; ++i) {
                        tmpObj = tmpList[t][i];
                        if (tmpObj.active && !tmpObj.dontGather && !hitObjs[tmpObj.sid] && tmpObj.visibleToPlayer(this)) {
                            tmpDist = UTILS.getDistance(this.x, this.y, tmpObj.x, tmpObj.y) - tmpObj.scale;
                            if (tmpDist <= items.weapons[this.weaponIndex].range) {
                                tmpDir = UTILS.getDirection(tmpObj.x, tmpObj.y, this.x, this.y);
                                if (UTILS.getAngleDist(tmpDir, this.dir) <= config.gatherAngle) {
                                    hitObjs[tmpObj.sid] = 1;
                                    if (tmpObj.health) {
                                        if (tmpObj.changeHealth(-items.weapons[this.weaponIndex].dmg * (variantDmg) *
                                                                (items.weapons[this.weaponIndex].sDmg || 1) * (this.skin && this.skin.bDmg ? this.skin.bDmg : 1), this)) {
                                            for (var x = 0; x < tmpObj.req.length;) {
                                                this.addResource(config.resourceTypes.indexOf(tmpObj.req[x]), tmpObj.req[x + 1]);
                                                x += 2;
                                            }
                                            objectManager.disableObj(tmpObj);
                                        }
                                    } else {
                                        this.earnXP(4 * items.weapons[this.weaponIndex].gather);
                                        var count = items.weapons[this.weaponIndex].gather + (tmpObj.type == 3 ? 4 : 0);
                                        if (this.skin && this.skin.extraGold) {
                                            this.addResource(3, 1);
                                        } this.addResource(tmpObj.type, count);
                                    }
                                    hitSomething = true;
                                    objectManager.hitObj(tmpObj, tmpDir);
                                }
                            }
                        }
                    }
                }

                // CHECK IF HIT PLAYER:
                for (var i = 0; i < players.length + ais.length; ++i) {
                    tmpObj = players[i] || ais[i - players.length];
                    if (tmpObj != this && tmpObj.alive && !(tmpObj.team && tmpObj.team == this.team)) {
                        tmpDist = UTILS.getDistance(this.x, this.y, tmpObj.x, tmpObj.y) - (tmpObj.scale * 1.8);
                        if (tmpDist <= items.weapons[this.weaponIndex].range) {
                            tmpDir = UTILS.getDirection(tmpObj.x, tmpObj.y, this.x, this.y);
                            if (UTILS.getAngleDist(tmpDir, this.dir) <= config.gatherAngle) {

                                // STEAL RESOURCES:
                                var stealCount = items.weapons[this.weaponIndex].steal;
                                if (stealCount && tmpObj.addResource) {
                                    stealCount = Math.min((tmpObj.points || 0), stealCount);
                                    this.addResource(3, stealCount);
                                    tmpObj.addResource(3, -stealCount);
                                }

                                // MELEE HIT PLAYER:
                                var dmgMlt = variantDmg;
                                if (tmpObj.weaponIndex != undefined && items.weapons[tmpObj.weaponIndex].shield &&
                                    UTILS.getAngleDist(tmpDir + Math.PI, tmpObj.dir) <= config.shieldAngle) {
                                    dmgMlt = items.weapons[tmpObj.weaponIndex].shield;
                                }
                                var dmgVal = items.weapons[this.weaponIndex].dmg *
                                    (this.skin && this.skin.dmgMultO ? this.skin.dmgMultO : 1) *
                                    (this.tail && this.tail.dmgMultO ? this.tail.dmgMultO : 1);
                                var tmpSpd = (0.3 * (tmpObj.weightM || 1)) + (items.weapons[this.weaponIndex].knock || 0);
                                tmpObj.xVel += tmpSpd * mathCOS(tmpDir);
                                tmpObj.yVel += tmpSpd * mathSIN(tmpDir);
                                if (this.skin && this.skin.healD)
                                    this.changeHealth(dmgVal * dmgMlt * this.skin.healD, this);
                                if (this.tail && this.tail.healD)
                                    this.changeHealth(dmgVal * dmgMlt * this.tail.healD, this);
                                if (tmpObj.skin && tmpObj.skin.dmg && dmgMlt == 1)
                                    this.changeHealth(-dmgVal * tmpObj.skin.dmg, tmpObj);
                                if (tmpObj.tail && tmpObj.tail.dmg && dmgMlt == 1)
                                    this.changeHealth(-dmgVal * tmpObj.tail.dmg, tmpObj);
                                if (tmpObj.dmgOverTime && this.skin && this.skin.poisonDmg &&
                                    !(tmpObj.skin && tmpObj.skin.poisonRes)) {
                                    tmpObj.dmgOverTime.dmg = this.skin.poisonDmg;
                                    tmpObj.dmgOverTime.time = this.skin.poisonTime || 1;
                                    tmpObj.dmgOverTime.doer = this;
                                } if (tmpObj.dmgOverTime && applyPoison &&
                                      !(tmpObj.skin && tmpObj.skin.poisonRes)) {
                                    tmpObj.dmgOverTime.dmg = 5;
                                    tmpObj.dmgOverTime.time = 5;
                                    tmpObj.dmgOverTime.doer = this;
                                } if (tmpObj.skin && tmpObj.skin.dmgK) {
                                    this.xVel -= tmpObj.skin.dmgK * mathCOS(tmpDir);
                                    this.yVel -= tmpObj.skin.dmgK * mathSIN(tmpDir);
                                } tmpObj.changeHealth(-dmgVal * dmgMlt, this, this);

                            }
                        }
                    }
                }

                // SEND FOR ANIMATION:
                this.sendAnimation(hitSomething ? 1 : 0);
            };

            // SEND ANIMATION:
            this.sendAnimation = function (hit) {
                for (var i = 0; i < players.length; ++i) {
                    if (this.sentTo[players[i].id] && this.canSee(players[i])) {
                        server.send(players[i].id, "K", this.sid, hit ? 1 : 0, this.weaponIndex);
                    }
                }
            };

            // ANIMATE:
            var tmpRatio = 0;
            var animIndex = 0;
            this.animate = function (delta) {
                if (this.animTime > 0) {
                    this.animTime -= delta;
                    if (this.animTime <= 0) {
                        this.animTime = 0;
                        this.dirPlus = 0;
                        tmpRatio = 0;
                        animIndex = 0;
                    } else {
                        if (animIndex == 0) {
                            tmpRatio += delta / (this.animSpeed * config.hitReturnRatio);
                            this.dirPlus = UTILS.lerp(0, this.targetAngle, Math.min(1, tmpRatio));
                            if (tmpRatio >= 1) {
                                tmpRatio = 1;
                                animIndex = 1;
                            }
                        } else {
                            tmpRatio -= delta / (this.animSpeed * (1 - config.hitReturnRatio));
                            this.dirPlus = UTILS.lerp(0, this.targetAngle, Math.max(0, tmpRatio));
                        }
                    }
                }
            };

            // GATHER ANIMATION:
            this.startAnim = function (didHit, index) {
                this.animTime = this.animSpeed = items.weapons[index].speed;
                this.targetAngle = (didHit ? -config.hitAngle : -Math.PI);
                tmpRatio = 0;
                animIndex = 0;
            };

            // CAN SEE:
            this.canSee = function (other) {
                if (!other) return false;
                if (other.skin && other.skin.invisTimer && other.noMovTimer
                    >= other.skin.invisTimer) return false;
                var dx = mathABS(other.x - this.x) - other.scale;
                var dy = mathABS(other.y - this.y) - other.scale;
                return dx <= (config.maxScreenWidth / 2) * 1.3 && dy <= (config.maxScreenHeight / 2) * 1.3;
            };

        };


        /***/
    }),

    /***/ "./src/js/data/projectile.js":
    /*!***********************************!*\
  !*** ./src/js/data/projectile.js ***!
  \***********************************/
    /*! no static exports found */
    /***/ (function (module, exports) {

        module.exports = function (players, ais, objectManager, items, config, UTILS, server) {

            // INIT:
            this.init = function (indx, x, y, dir, spd, dmg, rng, scl, owner) {
                this.active = true;
                this.indx = indx;
                this.x = x;
                this.y = y;
                this.dir = dir;
                this.skipMov = true;
                this.speed = spd;
                this.dmg = dmg;
                this.scale = scl;
                this.range = rng;
                this.owner = owner;
                if (server)
                    this.sentTo = {};
            };

            // UPDATE:
            var objectsHit = [];
            var tmpObj;
            this.update = function (delta) {
                if (this.active) {
                    var tmpSpeed = this.speed * delta;
                    var tmpScale;
                    if (!this.skipMov) {
                        this.x += tmpSpeed * Math.cos(this.dir);
                        this.y += tmpSpeed * Math.sin(this.dir);
                        this.range -= tmpSpeed;
                        if (this.range <= 0) {
                            this.x += this.range * Math.cos(this.dir);
                            this.y += this.range * Math.sin(this.dir);
                            tmpSpeed = 1;
                            this.range = 0;
                            this.active = false;
                        }
                    } else {
                        this.skipMov = false;
                    }
                    if (server) {
                        for (var i = 0; i < players.length; ++i) {
                            if (!this.sentTo[players[i].id] && players[i].canSee(this)) {
                                this.sentTo[players[i].id] = 1;
                                server.send(players[i].id, "X", UTILS.fixTo(this.x, 1), UTILS.fixTo(this.y, 1),
                                            UTILS.fixTo(this.dir, 2), UTILS.fixTo(this.range, 1), this.speed, this.indx, this.layer, this.sid);
                            }
                        }
                        objectsHit.length = 0;
                        for (var i = 0; i < players.length + ais.length; ++i) {
                            tmpObj = players[i] || ais[i - players.length];
                            if (tmpObj.alive && tmpObj != this.owner && !(this.owner.team && tmpObj.team == this.owner.team)) {
                                if (UTILS.lineInRect(tmpObj.x - tmpObj.scale, tmpObj.y - tmpObj.scale, tmpObj.x + tmpObj.scale,
                                                     tmpObj.y + tmpObj.scale, this.x, this.y, this.x + (tmpSpeed * Math.cos(this.dir)),
                                                     this.y + (tmpSpeed * Math.sin(this.dir)))) {
                                    objectsHit.push(tmpObj);
                                }
                            }
                        }
                        var tmpList = objectManager.getGridArrays(this.x, this.y, this.scale);
                        for (var x = 0; x < tmpList.length; ++x) {
                            for (var y = 0; y < tmpList[x].length; ++y) {
                                tmpObj = tmpList[x][y];
                                tmpScale = tmpObj.getScale();
                                if (tmpObj.active && !(this.ignoreObj == tmpObj.sid) && (this.layer <= tmpObj.layer) &&
                                    objectsHit.indexOf(tmpObj) < 0 && !tmpObj.ignoreCollision && UTILS.lineInRect(tmpObj.x - tmpScale, tmpObj.y - tmpScale, tmpObj.x + tmpScale, tmpObj.y + tmpScale,
                                                                                                                  this.x, this.y, this.x + (tmpSpeed * Math.cos(this.dir)), this.y + (tmpSpeed * Math.sin(this.dir)))) {
                                    objectsHit.push(tmpObj);
                                }
                            }
                        }

                        // HIT OBJECTS:
                        if (objectsHit.length > 0) {
                            var hitObj = null;
                            var shortDist = null;
                            var tmpDist = null;
                            for (var i = 0; i < objectsHit.length; ++i) {
                                tmpDist = UTILS.getDistance(this.x, this.y, objectsHit[i].x, objectsHit[i].y);
                                if (shortDist == null || tmpDist < shortDist) {
                                    shortDist = tmpDist;
                                    hitObj = objectsHit[i];
                                }
                            }
                            if (hitObj.isPlayer || hitObj.isAI) {
                                var tmpSd = 0.3 * (hitObj.weightM || 1);
                                hitObj.xVel += tmpSd * Math.cos(this.dir);
                                hitObj.yVel += tmpSd * Math.sin(this.dir);
                                if (hitObj.weaponIndex == undefined || (!(items.weapons[hitObj.weaponIndex].shield &&
                                                                          UTILS.getAngleDist(this.dir + Math.PI, hitObj.dir) <= config.shieldAngle))) {
                                    hitObj.changeHealth(-this.dmg, this.owner, this.owner);
                                }
                            } else {
                                if (hitObj.projDmg && hitObj.health && hitObj.changeHealth(-this.dmg)) {
                                    objectManager.disableObj(hitObj);
                                }
                                for (var i = 0; i < players.length; ++i) {
                                    if (players[i].active) {
                                        if (hitObj.sentTo[players[i].id]) {
                                            if (hitObj.active) {
                                                if (players[i].canSee(hitObj))
                                                    server.send(players[i].id, "L", UTILS.fixTo(this.dir, 2), hitObj.sid);
                                            } else {
                                                server.send(players[i].id, "Q", hitObj.sid);
                                            }
                                        }
                                        if (!hitObj.active && hitObj.owner == players[i])
                                            players[i].changeItemCount(hitObj.group.id, -1);
                                    }

                                }
                            }
                            this.active = false;
                            for (var i = 0; i < players.length; ++i) {
                                if (this.sentTo[players[i].id])
                                    server.send(players[i].id, "Y", this.sid, UTILS.fixTo(shortDist, 1));
                            }
                        }
                    }
                }
            };
        };


        /***/
    }),

    /***/ "./src/js/data/projectileManager.js":
    /*!******************************************!*\
  !*** ./src/js/data/projectileManager.js ***!
  \******************************************/
    /*! no static exports found */
    /***/ (function (module, exports) {

        module.exports = function (Projectile, projectiles, players, ais, objectManager, items, config, UTILS, server) {
            this.addProjectile = function (x, y, dir, range, speed, indx, owner, ignoreObj, layer) {
                var tmpData = items.projectiles[indx];
                var tmpProj;
                for (var i = 0; i < projectiles.length; ++i) {
                    if (!projectiles[i].active) {
                        tmpProj = projectiles[i];
                        break;
                    }
                } if (!tmpProj) {
                    tmpProj = new Projectile(players, ais, objectManager, items, config, UTILS, server);
                    tmpProj.sid = projectiles.length;
                    projectiles.push(tmpProj);
                }
                tmpProj.init(indx, x, y, dir, speed, tmpData.dmg, range, tmpData.scale, owner);
                tmpProj.ignoreObj = ignoreObj;
                tmpProj.layer = layer || tmpData.layer;
                tmpProj.src = tmpData.src;
                return tmpProj;
            };
        };


        /***/
    }),

    /***/ "./src/js/data/store.js":
    /*!******************************!*\
  !*** ./src/js/data/store.js ***!
  \******************************/
    /*! no static exports found */
    /***/ (function (module, exports) {


        // STORE hats:
        module.exports.hats = [{
            id: 45,
            name: "Shame!",
            dontSell: true,
            price: 0,
            scale: 120,
            desc: "hacks are for losers"
        }, {
            id: 51,
            name: "Moo Cap",
            price: 0,
            scale: 120,
            desc: "coolest mooer around"
        }, {
            id: 50,
            name: "Apple Cap",
            price: 0,
            scale: 120,
            desc: "apple farms remembers"
        }, {
            id: 28,
            name: "Moo Head",
            price: 0,
            scale: 120,
            desc: "no effect"
        }, {
            id: 29,
            name: "Pig Head",
            price: 0,
            scale: 120,
            desc: "no effect"
        }, {
            id: 30,
            name: "Fluff Head",
            price: 0,
            scale: 120,
            desc: "no effect"
        }, {
            id: 36,
            name: "Pandou Head",
            price: 0,
            scale: 120,
            desc: "no effect"
        }, {
            id: 37,
            name: "Bear Head",
            price: 0,
            scale: 120,
            desc: "no effect"
        }, {
            id: 38,
            name: "Monkey Head",
            price: 0,
            scale: 120,
            desc: "no effect"
        }, {
            id: 44,
            name: "Polar Head",
            price: 0,
            scale: 120,
            desc: "no effect"
        }, {
            id: 35,
            name: "Fez Hat",
            price: 0,
            scale: 120,
            desc: "no effect"
        }, {
            id: 42,
            name: "Enigma Hat",
            price: 0,
            scale: 120,
            desc: "join the enigma army"
        }, {
            id: 43,
            name: "Blitz Hat",
            price: 0,
            scale: 120,
            desc: "hey everybody i'm blitz"
        }, {
            id: 49,
            name: "Bob XIII Hat",
            price: 0,
            scale: 120,
            desc: "like and subscribe"
        }, {
            id: 57,
            name: "Pumpkin",
            price: 50,
            scale: 120,
            desc: "Spooooky"
        }, {
            id: 8,
            name: "Bummle Hat",
            price: 100,
            scale: 120,
            desc: "no effect"
        }, {
            id: 2,
            name: "Straw Hat",
            price: 500,
            scale: 120,
            desc: "no effect"
        }, {
            id: 15,
            name: "Winter Cap",
            price: 600,
            scale: 120,
            desc: "allows you to move at normal speed in snow",
            coldM: 1
        }, {
            id: 5,
            name: "Cowboy Hat",
            price: 1000,
            scale: 120,
            desc: "no effect"
        }, {
            id: 4,
            name: "Ranger Hat",
            price: 2000,
            scale: 120,
            desc: "no effect"
        }, {
            id: 18,
            name: "Explorer Hat",
            price: 2000,
            scale: 120,
            desc: "no effect"
        }, {
            id: 31,
            name: "Flipper Hat",
            price: 2500,
            scale: 120,
            desc: "have more control while in water",
            watrImm: true
        }, {
            id: 1,
            name: "Marksman Cap",
            price: 3000,
            scale: 120,
            desc: "increases arrow speed and range",
            aMlt: 1.3
        }, {
            id: 10,
            name: "Bush Gear",
            price: 3000,
            scale: 160,
            desc: "allows you to disguise yourself as a bush"
        }, {
            id: 48,
            name: "Halo",
            price: 3000,
            scale: 120,
            desc: "no effect"
        }, {
            id: 6,
            name: "Soldier Helmet",
            price: 4000,
            scale: 120,
            desc: "reduces damage taken but slows movement",
            spdMult: 0.94,
            dmgMult: 0.75
        }, {
            id: 23,
            name: "Anti Venom Gear",
            price: 4000,
            scale: 120,
            desc: "makes you immune to poison",
            poisonRes: 1
        }, {
            id: 13,
            name: "Medic Gear",
            price: 5000,
            scale: 110,
            desc: "slowly regenerates health over time",
            healthRegen: 3
        }, {
            id: 9,
            name: "Miners Helmet",
            price: 5000,
            scale: 120,
            desc: "earn 1 extra gold per resource",
            extraGold: 1
        }, {
            id: 32,
            name: "Musketeer Hat",
            price: 5000,
            scale: 120,
            desc: "reduces cost of projectiles",
            projCost: 0.5
        }, {
            id: 7,
            name: "Bull Helmet",
            price: 6000,
            scale: 120,
            desc: "increases damage done but drains health",
            healthRegen: -5,
            dmgMultO: 1.5,
            spdMult: 0.96
        }, {
            id: 22,
            name: "Emp Helmet",
            price: 6000,
            scale: 120,
            desc: "turrets won't attack but you move slower",
            antiTurret: 1,
            spdMult: 0.7
        }, {
            id: 12,
            name: "Booster Hat",
            price: 6000,
            scale: 120,
            desc: "increases your movement speed",
            spdMult: 1.16
        }, {
            id: 26,
            name: "Barbarian Armor",
            price: 8000,
            scale: 120,
            desc: "knocks back enemies that attack you",
            dmgK: 0.6
        }, {
            id: 21,
            name: "Plague Mask",
            price: 10000,
            scale: 120,
            desc: "melee attacks deal poison damage",
            poisonDmg: 5,
            poisonTime: 6
        }, {
            id: 46,
            name: "Bull Mask",
            price: 10000,
            scale: 120,
            desc: "bulls won't target you unless you attack them",
            bullRepel: 1
        }, {
            id: 14,
            name: "Windmill Hat",
            topSprite: true,
            price: 10000,
            scale: 120,
            desc: "generates points while worn",
            pps: 1.5
        }, {
            id: 11,
            name: "Spike Gear",
            topSprite: true,
            price: 10000,
            scale: 120,
            desc: "deal damage to players that damage you",
            dmg: 0.45
        }, {
            id: 53,
            name: "Turret Gear",
            topSprite: true,
            price: 10000,
            scale: 120,
            desc: "you become a walking turret",
            turret: {
                proj: 1,
                range: 700,
                rate: 2500
            },
            spdMult: 0.7
        }, {
            id: 20,
            name: "Samurai Armor",
            price: 12000,
            scale: 120,
            desc: "increased attack speed and fire rate",
            atkSpd: 0.78
        }, {
            id: 58,
            name: "Dark Knight",
            price: 12000,
            scale: 120,
            desc: "restores health when you deal damage",
            healD: 0.4
        }, {
            id: 27,
            name: "Scavenger Gear",
            price: 15000,
            scale: 120,
            desc: "earn double points for each kill",
            kScrM: 2
        }, {
            id: 40,
            name: "Tank Gear",
            price: 15000,
            scale: 120,
            desc: "increased damage to buildings but slower movement",
            spdMult: 0.3,
            bDmg: 3.3
        }, {
            id: 52,
            name: "Thief Gear",
            price: 15000,
            scale: 120,
            desc: "steal half of a players gold when you kill them",
            goldSteal: 0.5
        }, {
            id: 55,
            name: "Bloodthirster",
            price: 20000,
            scale: 120,
            desc: "Restore Health when dealing damage. And increased damage",
            healD: 0.25,
            dmgMultO: 1.2,
        }, {
            id: 56,
            name: "Assassin Gear",
            price: 20000,
            scale: 120,
            desc: "Go invisible when not moving. Can't eat. Increased speed",
            noEat: true,
            spdMult: 1.1,
            invisTimer: 1000
        }];

        // STORE ACCESSORIES:
        module.exports.accessories = [{
            id: 12,
            name: "Snowball",
            price: 1000,
            scale: 105,
            xOff: 18,
            desc: "no effect"
        }, {
            id: 9,
            name: "Tree Cape",
            price: 1000,
            scale: 90,
            desc: "no effect"
        }, {
            id: 10,
            name: "Stone Cape",
            price: 1000,
            scale: 90,
            desc: "no effect"
        }, {
            id: 3,
            name: "Cookie Cape",
            price: 1500,
            scale: 90,
            desc: "no effect"
        }, {
            id: 8,
            name: "Cow Cape",
            price: 2000,
            scale: 90,
            desc: "no effect"
        }, {
            id: 11,
            name: "Monkey Tail",
            price: 2000,
            scale: 97,
            xOff: 25,
            desc: "Super speed but reduced damage",
            spdMult: 1.35,
            dmgMultO: 0.2
        }, {
            id: 17,
            name: "Apple Basket",
            price: 3000,
            scale: 80,
            xOff: 12,
            desc: "slowly regenerates health over time",
            healthRegen: 1
        }, {
            id: 6,
            name: "Winter Cape",
            price: 3000,
            scale: 90,
            desc: "no effect"
        }, {
            id: 4,
            name: "Skull Cape",
            price: 4000,
            scale: 90,
            desc: "no effect"
        }, {
            id: 5,
            name: "Dash Cape",
            price: 5000,
            scale: 90,
            desc: "no effect"
        }, {
            id: 2,
            name: "Dragon Cape",
            price: 6000,
            scale: 90,
            desc: "no effect"
        }, {
            id: 1,
            name: "Super Cape",
            price: 8000,
            scale: 90,
            desc: "no effect"
        }, {
            id: 7,
            name: "Troll Cape",
            price: 8000,
            scale: 90,
            desc: "no effect"
        }, {
            id: 14,
            name: "Thorns",
            price: 10000,
            scale: 115,
            xOff: 20,
            desc: "no effect"
        }, {
            id: 15,
            name: "Blockades",
            price: 10000,
            scale: 95,
            xOff: 15,
            desc: "no effect"
        }, {
            id: 20,
            name: "Devils Tail",
            price: 10000,
            scale: 95,
            xOff: 20,
            desc: "no effect"
        }, {
            id: 16,
            name: "Sawblade",
            price: 12000,
            scale: 90,
            spin: true,
            xOff: 0,
            desc: "deal damage to players that damage you",
            dmg: 0.15
        }, {
            id: 13,
            name: "Angel Wings",
            price: 15000,
            scale: 138,
            xOff: 22,
            desc: "slowly regenerates health over time",
            healthRegen: 3
        }, {
            id: 19,
            name: "Shadow Wings",
            price: 15000,
            scale: 138,
            xOff: 22,
            desc: "increased movement speed",
            spdMult: 1.1
        }, {
            id: 18,
            name: "Blood Wings",
            price: 20000,
            scale: 178,
            xOff: 26,
            desc: "restores health when you deal damage",
            healD: 0.2
        }, {
            id: 21,
            name: "Corrupt X Wings",
            price: 20000,
            scale: 178,
            xOff: 26,
            desc: "deal damage to players that damage you",
            dmg: 0.25
        }];


        /***/
    }),

    /***/ "./src/js/libs/animText.js":
    /*!*********************************!*\
  !*** ./src/js/libs/animText.js ***!
  \*********************************/
    /*! no static exports found */
    /***/ (function (module, exports) {


        // ANIMATED TEXT:
        module.exports.AnimText = function () {

            // INIT:
            this.init = function (x, y, scale, speed, life, text, color) {
                this.x = x;
                this.y = y;
                this.color = color;
                this.scale = scale;
                this.startScale = this.scale;
                this.maxScale = scale * 1.5;
                this.scaleSpeed = 0.3;
                this.speed = speed;
                this.life = life;
                this.maxLife = life;
                this.text = text;
                this.damage = 0;

                // Animation phases
                this.popDuration = 0.15; // Pop up time
                this.holdDuration = 0.4; // Stay visible time
            };

            // UPDATE:
            this.update = function (delta) {
                if (this.life) {
                    this.life -= delta;
                    var elapsed = this.maxLife - this.life;

                    if (elapsed < this.popDuration) {
                        // POP PHASE: Scale up quickly
                        var popProgress = elapsed / this.popDuration;
                        this.scale = this.startScale + (this.maxScale - this.startScale) * popProgress;
                    } else if (elapsed < this.popDuration + this.holdDuration) {
                        // HOLD PHASE: Stay at max scale
                        this.scale = this.maxScale;
                    } else {
                        // FADE PHASE: Scale down and move DOWN
                        var fadeProgress = (elapsed - this.popDuration - this.holdDuration) / (this.maxLife - this.popDuration - this.holdDuration);
                        this.scale = this.maxScale * (1 - fadeProgress);
                        this.y += this.speed * delta; // Move DOWN
                    }

                    if (this.life <= 0) {
                        this.life = 0;
                    }
                }
            };

            // RENDER:
            this.render = function (ctxt, xOff, yOff) {
                ctxt.fillStyle = this.color;
                ctxt.font = this.scale + "px Hammersmith One";
                ctxt.globalAlpha = Math.max(0, this.life / this.maxLife); // Fade out alpha
                ctxt.fillText(this.text, this.x - xOff, this.y - yOff);
                ctxt.globalAlpha = 1; // Reset alpha
            }
        }
        // TEXT MANAGER:
        module.exports.TextManager = function () {
            this.texts = [];
            this.stackRange = 50;

            // UPDATE:
            this.update = function (delta, ctxt, xOff, yOff) {
                ctxt.textBaseline = "middle";
                ctxt.textAlign = "center";
                for (var i = 0; i < this.texts.length; ++i) {
                    if (this.texts[i].life) {
                        this.texts[i].update(delta);
                        this.texts[i].render(ctxt, xOff, yOff);
                    }
                }
            };

            this.findStackableText = function (x, y, color) {
                for (var i = 0; i < this.texts.length; ++i) {
                    if (this.texts[i].life > 0) {
                        var dx = this.texts[i].x - x;
                        var dy = this.texts[i].y - y;
                        var distance = Math.sqrt(dx * dx + dy * dy);

                        if (distance <= this.stackRange && this.texts[i].color === color) {
                            return this.texts[i];
                        }
                    }
                }
                return null;
            };

            // SHOW TEXT:
            this.showText = function (x, y, scale, speed, life, text, color) {
                var damageValue = parseInt(text);
                var isStackable = !isNaN(damageValue) && damageValue > 0;

                var stackTarget = null;
                if (isStackable) {
                    stackTarget = this.findStackableText(x, y, color);
                }

                if (stackTarget) {
                    // STACK: Add damage to existing text
                    stackTarget.damage += damageValue;
                    stackTarget.text = stackTarget.damage.toString();
                    stackTarget.life = life; // Refresh duration
                } else {
                    // CREATE NEW: Find available or create new text object
                    var tmpText;
                    for (var i = 0; i < this.texts.length; ++i) {
                        if (!this.texts[i].life) {
                            tmpText = this.texts[i];
                            break;
                        }
                    }
                    if (!tmpText) {
                        tmpText = new module.exports.AnimText();
                        this.texts.push(tmpText);
                    }
                    tmpText.init(x, y, scale, speed, life, text, color);
                    tmpText.damage = isStackable ? damageValue : 0;
                }
            };
        }

        /***/
    }),

    /***/ "./src/js/libs/io-client.js":
    /*!**********************************!*\
  !*** ./src/js/libs/io-client.js ***!
  \**********************************/
    /*! no static exports found */
    /***/ (function (module, exports, __webpack_require__) {

        var msgpack = __webpack_require__(/*! msgpack-lite */ "./node_modules/msgpack-lite/lib/browser.js");
        window.msgpack = msgpack; // expose for bot system
        var config = __webpack_require__(/*! ../config */ "./src/js/config.js");

        // --- NEW ENCRYPTION ARCHITECTURE ---
        const kn = window.WebSocket;
        const Ri = window.WebSocket && window.WebSocket.prototype.send;

        const Io = 1, jt = 6, Ht = 1;
        const bo = ["M", "D", "9", "e", "F", "z", "H", "K", "L", "N", "b", "P", "Q", "c", "6", "S", "0"];
        const To = ["A", "B", "C", "D", "E", "a", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U", "V", "X", "Y", "Z", "g", "1", "2", "3", "4", "5", "6", "7", "8", "9", "0"];

        function Co(e) {
            return function() {
                e |= 0, e = e + 1831565813 | 0;
                let t = Math.imul(e ^ e >>> 15, 1 | e);
                return t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t, ((t ^ t >>> 14) >>> 0) / 4294967296;
            }
        }

        function Oi(e, t) {
            const i = e.length, s = e.map((d, l) => l), n = Co(t >>> 0);
            for (let d = i - 1; d > 0; d--) {
                const l = Math.floor(n() * (d + 1)), c = s[d];
                s[d] = s[l], s[l] = c;
            }
            const a = {}, o = {};
            for (let d = 0; d < i; d++) a[e[d]] = s[d], o[s[d]] = e[d];
            return { enc: a, dec: o };
        }

        function Po(e) {
            const t = (e ^ Math.imul(Io, 2654435761)) >>> 0;
            return {
                c2s: Oi(bo, t),
                s2c: Oi(To, (t ^ 2246822507) >>> 0)
            };
        }

        const Do = new Uint32Array([1116352408, 1899447441, 3049323471, 3921009573, 961987163, 1508970993, 2453635748, 2870763221, 3624381080, 310598401, 607225278, 1426881987, 1925078388, 2162078206, 2614888103, 3248222580, 3835390401, 4022224774, 264347078, 604807628, 770255983, 1249150122, 1555081692, 1996064986, 2554220882, 2821834349, 2952996808, 3210313671, 3336571891, 3584528711, 113926993, 338241895, 666307205, 773529912, 1294757372, 1396182291, 1695183700, 1986661051, 2177026350, 2456956037, 2730485921, 2820302411, 3259730800, 3345764771, 3516065817, 3600352804, 4094571909, 275423344, 430227734, 506948616, 659060556, 883997877, 958139571, 1322822218, 1537002063, 1747873779, 1955562222, 2024104815, 2227730452, 2361852424, 2428436474, 2756734187, 3204031479, 3329325298]);

        function Vt(e) {
            const t = new Uint32Array([1779033703, 3144134277, 1013904242, 2773480762, 1359893119, 2600822924, 528734635, 1541459225]);
            const i = e.length, s = i * 8, n = i + 9;
            const a = new Uint8Array(Math.ceil(n / 64) * 64);
            a.set(e), a[i] = 128;
            const o = new DataView(a.buffer);
            o.setUint32(a.length - 4, s >>> 0, !1);
            o.setUint32(a.length - 8, Math.floor(s / 4294967296), !1);
            const d = new Uint32Array(64);
            for (let m = 0; m < a.length; m += 64) {
                for (let w = 0; w < 16; w++) d[w] = o.getUint32(m + w * 4, !1);
                for (let w = 16; w < 64; w++) {
                    const T = j(d[w - 15], 7) ^ j(d[w - 15], 18) ^ d[w - 15] >>> 3;
                    const A = j(d[w - 2], 17) ^ j(d[w - 2], 19) ^ d[w - 2] >>> 10;
                    d[w] = d[w - 16] + T + d[w - 7] + A | 0;
                }
                let g = t[0], h = t[1], u = t[2], p = t[3], x = t[4], I = t[5], P = t[6], f = t[7];
                for (let w = 0; w < 64; w++) {
                    const T = j(x, 6) ^ j(x, 11) ^ j(x, 25);
                    const A = x & I ^ ~x & P;
                    const V = f + T + A + Do[w] + d[w] | 0;
                    const W = j(g, 2) ^ j(g, 13) ^ j(g, 22);
                    const S = g & h ^ g & u ^ h & u;
                    const H = W + S | 0;
                    f = P, P = I, I = x, x = p + V | 0, p = u, u = h, h = g, g = V + H | 0;
                }
                t[0] = t[0] + g | 0;
                t[1] = t[1] + h | 0;
                t[2] = t[2] + u | 0;
                t[3] = t[3] + p | 0;
                t[4] = t[4] + x | 0;
                t[5] = t[5] + I | 0;
                t[6] = t[6] + P | 0;
                t[7] = t[7] + f | 0;
            }
            const l = new Uint8Array(32);
            const c = new DataView(l.buffer);
            for (let m = 0; m < 8; m++) c.setUint32(m * 4, t[m], !1);
            return l;
        }

        function j(e, t) {
            return e >>> t | e << 32 - t;
        }

        const he = 64;

        function Ao(e, t) {
            let i = e;
            if (i.length > he) i = Vt(i);
            const s = new Uint8Array(he);
            s.set(i);
            const n = new Uint8Array(he + t.length);
            const a = new Uint8Array(he + 32);
            for (let o = 0; o < he; o++) {
                n[o] = s[o] ^ 54;
                a[o] = s[o] ^ 92;
            }
            n.set(t, he);
            a.set(Vt(n), he);
            return Vt(a);
        }

        function Eo(e, t) {
            return Ao(e, t).subarray(0, jt);
        }

        function Ro(e) {
            const t = new Uint8Array(e.length / 2);
            for (let i = 0; i < t.length; i++) {
                t[i] = parseInt(e.substr(i * 2, 2), 16);
            }
            return t;
        }

        let Z = null;

        // Expose encryption functions globally for bots
        window._botEnc = {
            Ro, Po, Eo, jt, Ht
        };
        // --- END ENCRYPTION ARCHITECTURE ---

        module.exports = {
            socket: null,
            connected: false,
            socketId: -1,
            connect: function (address, callback, events) {
                if (this.socket) return;
                var _this = this;
                try {
                    var socketError = false;
                    this.socket = new kn(address);
                    this.socket.binaryType = "arraybuffer";
                    let o = false;
                    this.socket.onmessage = function (message) {
                        var data = new Uint8Array(message.data);
                        var parsed = msgpack.decode(data);
                        var type = parsed[0];
                        var payload = parsed[1];

                        if (type === "io-init") {
                            _this.socketId = payload[0];
                            if (payload[3] === Ht) {
                                Z = {
                                    mode: Ht,
                                    key: Ro(payload[2]),
                                    tables: Po(payload[1] >>> 0),
                                    seq: 0
                                };
                            } else {
                                Z = null;
                            }
                            if (!o) {
                                o = true;
                                callback();
                            }
                            return;
                        }

                        if (Z && typeof type === "number") {
                            type = Z.tables.s2c.dec[type];
                            if (type === undefined) return;
                        }

                        if (events[type]) {
                            events[type].apply(undefined, payload);
                        }
                    };
                    this.socket.onopen = function () {
                        _this.connected = true;
                    };
                    this.socket.onclose = function (event) {
                        _this.connected = false;
                        Z = null;
                        if (event.code == 4001) {
                            callback("Invalid Connection");
                        } else if (!socketError) {
                            callback("disconnected");
                        }
                    };
                    this.socket.onerror = function (error) {
                        if (this.socket && this.socket.readyState != WebSocket.OPEN) {
                            socketError = true;
                            console.error("Socket error", arguments);
                            callback("Socket error");
                        }
                    };
                } catch (e) {
                    console.warn("Socket connection error:", e);
                    callback(e);
                }
            },
            send: function (type) {
                var data = Array.prototype.slice.call(arguments, 1);
                if (!this.socket) return;

                // Packet tracking for the mod
                window.packets++;
                if (!window.packetInterval) {
                    window.packetInterval = setInterval(function () {
                        window.pps = window.packets;
                        window.packets = 0;
                    }, 1000);
                }

                if (Z && Z.mode === Ht) {
                    const s = Z.tables.c2s.enc[type];
                    if (s === undefined) return;
                    const n = ++Z.seq;
                    const a = msgpack.encode([s, data, n]);
                    const o = Eo(Z.key, a);
                    const d = new Uint8Array(jt + a.length);
                    d.set(o, 0);
                    d.set(a, jt);
                    Ri.call(this.socket, d);
                    return;
                }

                var binary = msgpack.encode([type, data]);
                Ri.call(this.socket, binary);
            },
            socketReady: function () {
                return (this.socket && this.connected);
            },
            close: function () {
                if (this.socket) this.socket.close();
                this.socket = null;
                this.connected = false;
                Z = null;
            }
        };

        /***/
    }),

    /***/ "./src/js/libs/modernizr.js":
    /*!**********************************!*\
  !*** ./src/js/libs/modernizr.js ***!
  \**********************************/
    /*! no static exports found */
    /***/ (function (module, exports) {

        !function (e, n, s) { function o(e, n) { return typeof e === n } function a() { var e, n, s, a, t, f, l; for (var c in r) if (r.hasOwnProperty(c)) { if (e = [], n = r[c], n.name && (e.push(n.name.toLowerCase()), n.options && n.options.aliases && n.options.aliases.length)) for (s = 0; s < n.options.aliases.length; s++)e.push(n.options.aliases[s].toLowerCase()); for (a = o(n.fn, "function") ? n.fn() : n.fn, t = 0; t < e.length; t++)f = e[t], l = f.split("."), 1 === l.length ? Modernizr[l[0]] = a : (!Modernizr[l[0]] || Modernizr[l[0]] instanceof Boolean || (Modernizr[l[0]] = new Boolean(Modernizr[l[0]])), Modernizr[l[0]][l[1]] = a), i.push((a ? "" : "no-") + l.join("-")) } } function t(e) { var n = l.className, s = Modernizr._config.classPrefix || ""; if (c && (n = n.baseVal), Modernizr._config.enableJSClass) { var o = new RegExp("(^|\\s)" + s + "no-js(\\s|$)"); n = n.replace(o, "$1" + s + "js$2") } Modernizr._config.enableClasses && (n += " " + s + e.join(" " + s), c ? l.className.baseVal = n : l.className = n) } var i = [], r = [], f = { _version: "3.5.0", _config: { classPrefix: "", enableClasses: !0, enableJSClass: !0, usePrefixes: !0 }, _q: [], on: function (e, n) { var s = this; setTimeout(function () { n(s[e]) }, 0) }, addTest: function (e, n, s) { r.push({ name: e, fn: n, options: s }) }, addAsyncTest: function (e) { r.push({ name: null, fn: e }) } }, Modernizr = function () { }; Modernizr.prototype = f, Modernizr = new Modernizr; var l = n.documentElement, c = "svg" === l.nodeName.toLowerCase(); Modernizr.addTest("passiveeventlisteners", function () { var n = !1; try { var s = Object.defineProperty({}, "passive", { get: function () { n = !0 } }); e.addEventListener("test", null, s) } catch (o) { } return n }), a(), t(i), delete f.addTest, delete f.addAsyncTest; for (var u = 0; u < Modernizr._q.length; u++)Modernizr._q[u](); e.Modernizr = Modernizr }(window, document);


        /***/
    }),

    /***/ "./src/js/libs/soundManager.js":
    /*!*************************************!*\
  !*** ./src/js/libs/soundManager.js ***!
  \*************************************/
    /*! no static exports found */
    /***/ (function (module, exports) {


        // PLAYER MANAGER:
        module.exports.obj = function (config, UTILS) {

            // INIT:
            var tmpSound;
            this.sounds = [];
            this.active = true;

            // PLAY SOUND:
            this.play = function (id, volume, loop) {
                if (!volume || !this.active) return;
                tmpSound = this.sounds[id];
                if (!tmpSound) {
                    tmpSound = new Howl({
                        src: ".././sound/" + id + ".mp3"
                    });
                    this.sounds[id] = tmpSound;
                }
                if (!loop || !tmpSound.isPlaying) {
                    tmpSound.isPlaying = true;
                    tmpSound.play();
                    tmpSound.volume((volume || 1) * config.volumeMult);
                    tmpSound.loop(loop);
                }
            };

            // TOGGLE MUTE:
            this.toggleMute = function (id, mute) {
                tmpSound = this.sounds[id];
                if (tmpSound) tmpSound.mute(mute);
            };

            // STOP SOUND:
            this.stop = function (id) {
                tmpSound = this.sounds[id];
                if (tmpSound) {
                    tmpSound.stop();
                    tmpSound.isPlaying = false;
                }
            };

        };


        /***/
    }),

    /***/ "./src/js/libs/utils.js":
    /*!******************************!*\
  !*** ./src/js/libs/utils.js ***!
  \******************************/
    /*! no static exports found */
    /***/ (function (module, exports) {


        // MATH UTILS:
        var mathABS = Math.abs;
        var mathCOS = Math.cos;
        var mathSIN = Math.sin;
        var mathPOW = Math.pow;
        var mathSQRT = Math.sqrt;
        var mathHYPOT = Math.hypot;
        var mathATAN2 = Math.atan2;
        var mathPI = Math.PI;

        // GLOBAL UTILS:
        module.exports.toRad = function (angle) {
            return angle * (Math.PI / 180);
        };
        module.exports.toAng = function (radian) {
            return radian / (Math.PI / 180);
        };
        module.exports.randInt = function (min, max) {
            return Math.floor(Math.random() * (max - min + 1)) + min;
        };
        module.exports.randFloat = function (min, max) {
            return Math.random() * (max - min + 1) + min;
        };
        module.exports.lerp = function (value1, value2, amount) {
            return value1 + (value2 - value1) * amount;
        };
        module.exports.decel = function (val, cel) {
            if (val > 0)
                val = Math.max(0, val - cel);
            else if (val < 0)
                val = Math.min(0, val + cel);
            return val;
        };
        module.exports.getDistance = function (x1, y1, x2, y2) {
            return mathSQRT((x2 -= x1) * x2 + (y2 -= y1) * y2);
        };
        module.exports.getDist = function (tmp1, tmp2) {
            return mathSQRT((tmp2.x -= tmp1.x) * tmp2.x + (tmp2.y -= tmp1.y) * tmp2.y);
        };
        module.exports.getDirection = function (x1, y1, x2, y2) {
            return mathATAN2(y1 - y2, x1 - x2);
        };
        module.exports.getDirect = function (tmp1, tmp2) {
            return mathATAN2(tmp1.y - tmp2.y, tmp1.x - tmp2.x);
        };
        module.exports.getAngleDist = function (a, b) {
            var p = mathABS(b - a) % (mathPI * 2);
            return (p > mathPI ? (mathPI * 2) - p : p);
        };
        module.exports.isNumber = function (n) {
            return (typeof n == "number" && !isNaN(n) && isFinite(n));
        };
        module.exports.isString = function (s) {
            return (s && typeof s == "string");
        };
        module.exports.kFormat = function (num) {
            return num > 999 ? (num / 1000).toFixed(1) + 'k' : num;
        };
        module.exports.capitalizeFirst = function (string) {
            return string.charAt(0).toUpperCase() + string.slice(1);
        };
        module.exports.fixTo = function (n, v) {
            return parseFloat(n.toFixed(v));
        };
        module.exports.sortByPoints = function (a, b) {
            return parseFloat(b.points) - parseFloat(a.points);
        };
        module.exports.lineInRect = function (recX, recY, recX2, recY2, x1, y1, x2, y2) {
            var minX = x1;
            var maxX = x2;
            if (x1 > x2) {
                minX = x2;
                maxX = x1;
            }
            if (maxX > recX2)
                maxX = recX2;
            if (minX < recX)
                minX = recX;
            if (minX > maxX)
                return false;
            var minY = y1;
            var maxY = y2;
            var dx = x2 - x1;
            if (Math.abs(dx) > 0.0000001) {
                var a = (y2 - y1) / dx;
                var b = y1 - a * x1;
                minY = a * minX + b;
                maxY = a * maxX + b;
            }
            if (minY > maxY) {
                var tmp = maxY;
                maxY = minY;
                minY = tmp;
            }
            if (maxY > recY2)
                maxY = recY2;
            if (minY < recY)
                minY = recY;
            if (minY > maxY)
                return false;
            return true;
        };
        module.exports.containsPoint = function (element, x, y) {
            var bounds = element.getBoundingClientRect();
            var left = bounds.left + window.scrollX;
            var top = bounds.top + window.scrollY;
            var width = bounds.width;
            var height = bounds.height;

            var insideHorizontal = x > left && x < left + width;
            var insideVertical = y > top && y < top + height;
            return insideHorizontal && insideVertical;
        };
        module.exports.mousifyTouchEvent = function (event) {
            var touch = event.changedTouches[0];
            event.screenX = touch.screenX;
            event.screenY = touch.screenY;
            event.clientX = touch.clientX;
            event.clientY = touch.clientY;
            event.pageX = touch.pageX;
            event.pageY = touch.pageY;
        };
        module.exports.hookTouchEvents = function (element, skipPrevent) {
            var preventDefault = !skipPrevent;
            var isHovering = false;
            // var passive = window.Modernizr.passiveeventlisteners ? {passive: true} : false;
            var passive = false;
            element.addEventListener("touchstart", module.exports.checkTrusted(touchStart), passive);
            element.addEventListener("touchmove", module.exports.checkTrusted(touchMove), passive);
            element.addEventListener("touchend", module.exports.checkTrusted(touchEnd), passive);
            element.addEventListener("touchcancel", module.exports.checkTrusted(touchEnd), passive);
            element.addEventListener("touchleave", module.exports.checkTrusted(touchEnd), passive);
            function touchStart(e) {
                module.exports.mousifyTouchEvent(e);
                window.setUsingTouch(true);
                if (preventDefault) {
                    e.preventDefault();
                    e.stopPropagation();
                }
                if (element.onmouseover)
                    element.onmouseover(e);
                isHovering = true;
            }
            function touchMove(e) {
                module.exports.mousifyTouchEvent(e);
                window.setUsingTouch(true);
                if (preventDefault) {
                    e.preventDefault();
                    e.stopPropagation();
                }
                if (module.exports.containsPoint(element, e.pageX, e.pageY)) {
                    if (!isHovering) {
                        if (element.onmouseover)
                            element.onmouseover(e);
                        isHovering = true;
                    }
                } else {
                    if (isHovering) {
                        if (element.onmouseout)
                            element.onmouseout(e);
                        isHovering = false;
                    }
                }
            }
            function touchEnd(e) {
                module.exports.mousifyTouchEvent(e);
                window.setUsingTouch(true);
                if (preventDefault) {
                    e.preventDefault();
                    e.stopPropagation();
                }
                if (isHovering) {
                    if (element.onclick)
                        element.onclick(e);
                    if (element.onmouseout)
                        element.onmouseout(e);
                    isHovering = false;
                }
            }
        };
        module.exports.removeAllChildren = function (element) {
            while (element.hasChildNodes()) {
                element.removeChild(element.lastChild);
            }
        };
        module.exports.generateElement = function (config) {
            var element = document.createElement(config.tag || "div");
            function bind(configValue, elementValue) {
                if (config[configValue])
                    element[elementValue] = config[configValue];
            }
            bind("text", "textContent");
            bind("html", "innerHTML");
            bind("class", "className");
            for (var key in config) {
                switch (key) {
                    case "tag":
                    case "text":
                    case "html":
                    case "class":
                    case "style":
                    case "hookTouch":
                    case "parent":
                    case "children":
                        continue;
                    default:
                        break;
                }
                element[key] = config[key];
            }
            if (element.onclick)
                element.onclick = module.exports.checkTrusted(element.onclick);
            if (element.onmouseover)
                element.onmouseover = module.exports.checkTrusted(element.onmouseover);
            if (element.onmouseout)
                element.onmouseout = module.exports.checkTrusted(element.onmouseout);
            if (config.style) {
                element.style.cssText = config.style;
            }
            if (config.hookTouch) {
                module.exports.hookTouchEvents(element);
            }
            if (config.parent) {
                config.parent.appendChild(element);
            }
            if (config.children) {
                for (var i = 0; i < config.children.length; i++) {
                    element.appendChild(config.children[i]);
                }
            }
            return element;
        }
        module.exports.eventIsTrusted = function (ev) {
            if (ev && typeof ev.isTrusted == "boolean") {
                return ev.isTrusted;
            } else {
                return true;
            }
        }
        module.exports.checkTrusted = function (callback) {
            return function (ev) {
                if (ev && ev instanceof Event && module.exports.eventIsTrusted(ev)) {
                    callback(ev);
                } else {
                    //console.error("Event is not trusted.", ev);
                }
            }
        }
        module.exports.randomString = function (length) {
            var text = "";
            var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
            for (var i = 0; i < length; i++) {
                text += possible.charAt(Math.floor(Math.random() * possible.length));
            }
            return text;
        };
        module.exports.countInArray = function (array, val) {
            var count = 0;
            for (var i = 0; i < array.length; i++) {
                if (array[i] === val) count++;
            } return count;
        };

        // FLATMAP:
        var concat = function (x, y) { return x.concat(y) };

        var flatMap = function (f, xs) { return xs.map(f).reduce(concat, []); };

        Array.prototype.flatMap = function (f) {
            return flatMap(f, this)
        };

        //module.exports = VultrClient;


        /***/
    })

    /******/
});
//# sourceMappingURL=bundle.js.map
//# sourceMappingURL=bundle.js.map
(function () {
    'use strict';

    const STORAGE_KEY = "rageok_V4_CONFIG";

    // =========================================================================
    //  >>> DEFAULT SETTINGS <<<
    // =========================================================================

    window.vars = {
        // Keybinds
        keyAutoMills: "B",
        keyPlaceTrap: "F",
        keyPlaceSpike: "V",
        keyAutoGrind: "G",
        keyPathBreak: "Z",
        keyPlaceTurret: "H",

        // Combat
        shameTick: true,
        shameTick2: true,
        shameGrind: true,
        autoShame: false,
        autoShameLimit: 4,
        autoPlay: false,
        autoPush: true,
        circleTrappedEnemy: true,

        // Defense
        safeSoldier: true,
        antiSmart: false,

        // Placers
        autoPlace: true,
        placeRange: 300,
        prePlace: true,
        replace: true,
        velocityTick: false,

        // Utilities
        autoBuy: true,

        // Visuals
        millRotation: false,
        spikeRotation: false,

        // Settings
        theme: "",

        // Misc
        usernameCycler: false,
        usernameList: "Player1, Player2, Player3",
        usernameIndex: 0,
        killChat: false,
        chatMsg: "ohio god",
    };

    // Load saved settings
    const savedSettings = localStorage.getItem(STORAGE_KEY);
    if (savedSettings) {
        try {
            const parsed = JSON.parse(savedSettings);
            Object.assign(window.vars, parsed);
        } catch (e) {
            console.log("RAGEMASTER: Corrupt settings, resetting.");
        }
    }

    function saveConfig() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(window.vars));
    }

    // =========================================================================
    //  >>> MENU CONFIGURATION <<<
    // =========================================================================

    const MenuConfig = {
        keybinds: [
            {
                title: "Placement Keys",
                items: [
                    { type: 'keybind', name: "Place Spike", id: "keyPlaceSpike" },
                    { type: 'keybind', name: "Place Trap", id: "keyPlaceTrap" },
                    { type: 'keybind', name: "Place Turret", id: "keyPlaceTurret" },
                    { type: 'keybind', name: "Auto Triple Mills", id: "keyAutoMills" }
                ]
            },
            {
                title: "Automation Keys",
                items: [
                    { type: 'keybind', name: "Grind 3 turrets", id: "keyAutoGrind" },
                    { type: 'keybind', name: "Auto Clear", id: "keyPathBreak" }
                ]
            }
        ],
        combat: [
            {
                title: "Shame Combat",
                items: [
                    { type: 'toggle', name: "Spike Tick", id: "shameTick" },
                    { type: 'toggle', name: "Spike Tick 2", id: "shameTick2" },
                    { type: 'toggle', name: "Shame Grinder", id: "shameGrind" },
                    { type: 'toggle', name: "Auto Shame", id: "autoShame" },
                    { type: 'slider', name: "Shame Limit", id: "autoShameLimit", min: 0, max: 8 }
                ]
            },
            {
                title: "Movement Assist",
                items: [
                    { type: 'toggle', name: "autoPlay", id: "autoPlay" },
                    { type: 'toggle', name: "autoPush", id: "autoPush" },
                    { type: 'toggle', name: "ai retrep", id: "circleTrappedEnemy" }
                ]
            }
        ],
        defense: [
            {
                title: "General",
                items: [
                    { type: 'toggle', name: "Safe Soldier", id: "safeSoldier" }
                ]
            },
            {
                title: "Knockbacks",
                items: [
                    { type: 'toggle', name: "Anti Smart-Tick", id: "antiSmart" }
                ]
            }
        ],
        placers: [
            {
                title: "Autoplacer",
                items: [
                    { type: 'toggle', name: "Enable Autoplacer", id: "autoPlace" },
                    { type: 'slider', name: "Activation Range", id: "placeRange", min: 100, max: 500 }
                ]
            },
            {
                title: "Preplacer",
                items: [
                    { type: 'toggle', name: "Enable Preplacer", id: "prePlace" }
                ]
            },
            {
                title: "Replace",
                items: [
                    { type: 'toggle', name: "Enable Replace", id: "replace" }
                ]
            },
            {
                title: "Velocity Tick",
                items: [
                    { type: 'toggle', name: "Enable Velocity Tick", id: "velocityTick" }
                ]
            }
        ],
        utilities: [
            {
                title: "ACTIONS",
                items: [
                    { type: 'toggle', name: "Autobuy", id: "autoBuy" }
                ]
            }
        ],
        misc: [
            {
                title: "Killchat",
                items: [
                    { type: 'toggle', name: "Enable Killchat", id: "killChat" },
                    { type: 'input', name: "Change Killchat", id: "chatMsg" }
                ]
            },
            {
                title: "Username Cycler",
                items: [
                    { type: 'toggle', name: "Cycle Usernames", id: "usernameCycler" },
                    { type: 'input', name: "Usernames (comma sep)", id: "usernameList" }
                ]
            }
        ],
        visuals: [
            {
                title: "Objects",
                items: [
                    { type: 'toggle', name: "Spikes rotation", id: "spikeRotation" },
                    { type: 'toggle', name: "Mills rotation", id: "millRotation" }
                ]
            }
        ],
        menu: [
            {
                title: "Themes",
                items: [
                    { type: 'theme_select', id: "theme" }
                ]
            }
        ]
    };

    // =========================================================================
    //  >>> ADVANCED DARK STYLES <<<
    // =========================================================================

    const styles = `
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600;700&display=swap');

    :root {
        --bg-void: #000000;
        --bg-deep: #0a0a0f;
        --bg-dark: #0f0f17;
        --bg-panel: #14141f;
        --bg-card: #18182a;
        --bg-hover: #1d1d33;
        --bg-input: #0a0a14;

        --text-white: #ffffff;
        --text-bright: #e8e8f0;
        --text-normal: #b8b8cc;
        --text-dim: #7a7a8f;
        --text-muted: #4a4a5f;

        --purple-900: #4c1d95;
        --purple-700: #6d28d9;
        --purple-600: #7c3aed;
        --purple-500: #8b5cf6;
        --purple-400: #a78bfa;
        --purple-300: #c4b5fd;

        --accent: var(--purple-600);
        --accent-bright: var(--purple-400);
        --accent-dark: var(--purple-700);
        --accent-glow: rgba(124, 58, 237, 0.4);
        --accent-dim: rgba(124, 58, 237, 0.08);

        --border-subtle: rgba(124, 58, 237, 0.08);
        --border-normal: rgba(124, 58, 237, 0.15);
        --border-bright: rgba(124, 58, 237, 0.35);

        --shadow-sm: 0 2px 8px rgba(0, 0, 0, 0.6);
        --shadow-md: 0 4px 16px rgba(0, 0, 0, 0.7);
        --shadow-lg: 0 8px 32px rgba(0, 0, 0, 0.8);
        --shadow-glow: 0 0 40px rgba(124, 58, 237, 0.15);

        --radius-sm: 8px;
        --radius-md: 12px;
        --radius-lg: 16px;
        --radius-xl: 20px;
    }

    /* THEME VARIANTS */
    .t-nvg {
        --accent: #10b981; --accent-bright: #34d399; --accent-dark: #059669;
        --accent-glow: rgba(16, 185, 129, 0.4); --accent-dim: rgba(16, 185, 129, 0.08);
        --border-subtle: rgba(16, 185, 129, 0.08); --border-normal: rgba(16, 185, 129, 0.15); --border-bright: rgba(16, 185, 129, 0.35);
    }
    .t-ice {
        --accent: #0ea5e9; --accent-bright: #38bdf8; --accent-dark: #0284c7;
        --accent-glow: rgba(14, 165, 233, 0.4); --accent-dim: rgba(14, 165, 233, 0.08);
        --border-subtle: rgba(14, 165, 233, 0.08); --border-normal: rgba(14, 165, 233, 0.15); --border-bright: rgba(14, 165, 233, 0.35);
    }
    .t-red {
        --accent: #ef4444; --accent-bright: #f87171; --accent-dark: #dc2626;
        --accent-glow: rgba(239, 68, 68, 0.4); --accent-dim: rgba(239, 68, 68, 0.08);
        --border-subtle: rgba(239, 68, 68, 0.08); --border-normal: rgba(239, 68, 68, 0.15); --border-bright: rgba(239, 68, 68, 0.35);
    }
    .t-void {
        --accent: #d946ef; --accent-bright: #e879f9; --accent-dark: #c026d3;
        --accent-glow: rgba(217, 70, 239, 0.4); --accent-dim: rgba(217, 70, 239, 0.08);
        --border-subtle: rgba(217, 70, 239, 0.08); --border-normal: rgba(217, 70, 239, 0.15); --border-bright: rgba(217, 70, 239, 0.35);
    }

    .rageok-root * {
        margin: 0; padding: 0; box-sizing: border-box;
        font-family: 'Inter', -apple-system, sans-serif;
        outline: none;
    }

    /* MAIN CONTAINER */
    .rageok-root {
        position: fixed;
        top: 50%; left: 50%;
        transform: translate(-50%, -50%);
        width: 960px;
        height: 660px;
        background: var(--bg-void);
        border: 1px solid var(--border-normal);
        border-radius: var(--radius-xl);
        box-shadow: var(--shadow-lg), var(--shadow-glow), 0 0 0 1px var(--border-subtle) inset;
        color: var(--text-white);
        display: grid;
        grid-template-columns: 260px 1fr;
        opacity: 0;
        pointer-events: none;
        z-index: 999999;
        overflow: hidden;
        transition: all 0.35s cubic-bezier(0.16, 1, 0.3, 1);
    }

    .rageok-root.active {
        opacity: 1;
        pointer-events: auto;
    }

    /* ANIMATED BACKGROUND GRADIENT */
    .rageok-root::before {
        content: '';
        position: absolute;
        inset: 0;
        background:
            radial-gradient(circle at 10% 20%, var(--accent-dim) 0%, transparent 50%),
            radial-gradient(circle at 90% 80%, var(--accent-dim) 0%, transparent 50%);
        opacity: 0.6;
        animation: bgPulse 8s ease-in-out infinite;
        pointer-events: none;
    }

    @keyframes bgPulse {
        0%, 100% { opacity: 0.4; }
        50% { opacity: 0.7; }
    }

    /* SIDEBAR */
    .rageok-sidebar {
        background: var(--bg-deep);
        border-right: 1px solid var(--border-normal);
        display: flex;
        flex-direction: column;
        padding: 28px 0;
        position: relative;
        z-index: 2;
    }

    .rageok-sidebar::before {
        content: '';
        position: absolute;
        top: 0; right: 0;
        width: 1px;
        height: 100%;
        background: linear-gradient(to bottom, transparent, var(--accent-glow), transparent);
        opacity: 0.5;
    }

    .rageok-logo {
        padding: 0 24px 24px;
        margin-bottom: 20px;
        border-bottom: 1px solid var(--border-subtle);
    }

    .rageok-logo h1 {
        font-size: 36px;
        font-weight: 900;
        background: linear-gradient(135deg, var(--text-white) 0%, var(--accent-bright) 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        letter-spacing: -2px;
        text-shadow: 0 0 30px var(--accent-glow);
        margin-bottom: 6px;
    }

    .rageok-logo span {
        font-family: 'JetBrains Mono', monospace;
        font-size: 9px;
        color: var(--text-dim);
        letter-spacing: 3px;
        text-transform: uppercase;
        font-weight: 600;
    }

    /* NAVIGATION */
    .nav-container {
        display: flex;
        flex-direction: column;
        gap: 3px;
        overflow-y: auto;
        padding: 0 12px;
    }

    .nav-container::-webkit-scrollbar { width: 4px; }
    .nav-container::-webkit-scrollbar-track { background: transparent; }
    .nav-container::-webkit-scrollbar-thumb {
        background: var(--accent-dim);
        border-radius: 2px;
    }
    .nav-container::-webkit-scrollbar-thumb:hover {
        background: var(--accent);
    }

    .nav-item {
        padding: 13px 18px;
        border-radius: var(--radius-md);
        cursor: pointer;
        color: var(--text-dim);
        font-size: 13.5px;
        font-weight: 600;
        display: flex;
        align-items: center;
        gap: 14px;
        transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
        position: relative;
        border: 1px solid transparent;
    }

    .nav-item::before {
        content: '';
        position: absolute;
        left: 0;
        width: 3px;
        height: 0;
        background: var(--accent);
        border-radius: 0 2px 2px 0;
        transition: height 0.25s cubic-bezier(0.4, 0, 0.2, 1);
        box-shadow: 0 0 10px var(--accent-glow);
    }

    .nav-item svg {
        width: 19px;
        height: 19px;
        fill: currentColor;
        opacity: 0.6;
        transition: all 0.25s;
    }

    .nav-item:hover {
        background: rgba(255, 255, 255, 0.03);
        color: var(--text-bright);
        transform: translateX(3px);
        border-color: var(--border-subtle);
    }

    .nav-item:hover svg {
        opacity: 0.9;
        transform: scale(1.08);
    }

    .nav-item.active {
        background: var(--accent-dim);
        color: var(--accent-bright);
        border-color: var(--border-normal);
        box-shadow: var(--shadow-sm);
    }

    .nav-item.active::before {
        height: 100%;
    }

    .nav-item.active svg {
        opacity: 1;
        fill: var(--accent-bright);
        filter: drop-shadow(0 0 8px var(--accent-glow));
    }

    /* MAIN CONTENT */
    .rageok-main {
        display: flex;
        flex-direction: column;
        height: 100%;
        position: relative;
        z-index: 2;
        background: var(--bg-dark);
    }

    /* HEADER */
    .rageok-header {
        height: 84px;
        padding: 0 36px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        border-bottom: 1px solid var(--border-normal);
        background: var(--bg-panel);
        position: relative;
    }

    .rageok-header::after {
        content: '';
        position: absolute;
        bottom: 0;
        left: 0;
        right: 0;
        height: 1px;
        background: linear-gradient(to right, transparent, var(--accent-glow), transparent);
        opacity: 0.3;
    }

    .header-title {
        font-size: 22px;
        font-weight: 800;
        color: var(--text-white);
        letter-spacing: -0.5px;
        text-shadow: 0 2px 20px var(--accent-glow);
    }

    .search-wrap {
        position: relative;
    }

    .search-wrap::before {
        content: '🔍';
        position: absolute;
        left: 16px;
        top: 50%;
        transform: translateY(-50%);
        font-size: 13px;
        opacity: 0.4;
        filter: grayscale(1);
        pointer-events: none;
    }

    .search-input {
        background: var(--bg-input);
        border: 1px solid var(--border-subtle);
        color: var(--text-bright);
        padding: 11px 18px 11px 44px;
        width: 220px;
        border-radius: 50px;
        font-size: 13px;
        font-weight: 500;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .search-input:focus {
        width: 280px;
        border-color: var(--accent);
        background: var(--bg-panel);
        box-shadow: 0 0 0 4px var(--accent-dim), 0 4px 12px rgba(0,0,0,0.3);
    }

    /* CONTENT GRID */
    .rageok-content {
        padding: 28px;
        overflow-y: auto;
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        grid-auto-rows: min-content;
        gap: 22px;
        align-content: start;
        flex: 1;
        min-height: 0;
    }

    .rageok-content.bots-mode {
        display: flex !important;
        flex-direction: column !important;
        grid-template-columns: unset !important;
        padding: 0 !important;
        gap: 0 !important;
        align-content: unset !important;
        overflow-y: auto !important;
        overflow-x: hidden !important;
        height: 100% !important;
        max-height: 100% !important;
    }

    .rageok-content::-webkit-scrollbar { width: 6px; }
    .rageok-content::-webkit-scrollbar-track { background: transparent; }
    .rageok-content::-webkit-scrollbar-thumb {
        background: var(--accent-dim);
        border-radius: 3px;
    }
    .rageok-content::-webkit-scrollbar-thumb:hover {
        background: var(--accent);
    }

    /* CARDS */
    .rageok-card {
        background: var(--bg-panel);
        border: 1px solid var(--border-subtle);
        border-radius: var(--radius-lg);
        overflow: hidden;
        height: fit-content;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        position: relative;
    }

    .rageok-card::before {
        content: '';
        position: absolute;
        inset: 0;
        border-radius: var(--radius-lg);
        padding: 1px;
        background: linear-gradient(135deg, var(--border-bright), transparent);
        -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
        -webkit-mask-composite: xor;
        mask-composite: exclude;
        opacity: 0;
        transition: opacity 0.3s;
        pointer-events: none;
    }

    .rageok-card:hover {
        border-color: var(--border-normal);
        transform: translateY(-3px);
        box-shadow: var(--shadow-md), 0 0 20px var(--accent-glow);
        background: var(--bg-card);
    }

    .rageok-card:hover::before {
        opacity: 1;
    }

    .card-title {
        padding: 16px 22px;
        font-size: 10.5px;
        font-weight: 800;
        color: var(--accent-bright);
        text-transform: uppercase;
        letter-spacing: 1.5px;
        border-bottom: 1px solid var(--border-subtle);
        background: rgba(0, 0, 0, 0.3);
    }

    /* FEATURE ROWS */
    .feature-row {
        padding: 15px 22px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.02);
        display: flex;
        align-items: center;
        justify-content: space-between;
        min-height: 58px;
        transition: background 0.2s;
    }

    .feature-row:last-child { border-bottom: none; }

    .feature-row:hover {
        background: rgba(255, 255, 255, 0.02);
    }

    .feature-row.stacked {
        flex-direction: column;
        align-items: flex-start;
        gap: 12px;
        padding: 18px 22px;
    }

    .feat-label {
        font-size: 13.5px;
        font-weight: 500;
        color: var(--text-normal);
        letter-spacing: -0.2px;
    }

    /* SWITCH */
    .switch {
        width: 48px;
        height: 26px;
        background: var(--bg-input);
        border: 1px solid var(--border-subtle);
        border-radius: 13px;
        position: relative;
        cursor: pointer;
        transition: all 0.35s cubic-bezier(0.4, 0, 0.2, 1);
        box-shadow: inset 0 2px 6px rgba(0, 0, 0, 0.6);
    }

    .knob {
        position: absolute;
        top: 3px;
        left: 3px;
        width: 18px;
        height: 18px;
        background: var(--text-dim);
        border-radius: 50%;
        transition: all 0.35s cubic-bezier(0.4, 0, 0.2, 1);
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.4);
    }

    .switch.active {
        background: var(--accent);
        border-color: var(--accent-bright);
        box-shadow: 0 0 20px var(--accent-glow), inset 0 2px 6px rgba(0, 0, 0, 0.3);
    }

    .switch.active .knob {
        left: 25px;
        background: var(--text-white);
        box-shadow: 0 0 12px var(--accent-glow);
    }

    /* SLIDER */
    .slider-wrapper {
        width: 100%;
        display: flex;
        align-items: center;
        gap: 14px;
    }

    .slider-val {
        font-family: 'JetBrains Mono', monospace;
        font-size: 12px;
        font-weight: 700;
        color: var(--accent-bright);
        padding: 5px 12px;
        background: var(--bg-input);
        border-radius: var(--radius-sm);
        min-width: 42px;
        text-align: center;
        border: 1px solid var(--border-subtle);
        box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.4);
    }

    input[type=range] {
        -webkit-appearance: none;
        width: 100%;
        height: 5px;
        background: var(--bg-input);
        border-radius: 3px;
        border: 1px solid var(--border-subtle);
        box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.4);
    }

    input[type=range]::-webkit-slider-thumb {
        -webkit-appearance: none;
        width: 16px;
        height: 16px;
        background: var(--accent-bright);
        border-radius: 50%;
        cursor: pointer;
        box-shadow: 0 0 12px var(--accent-glow), 0 2px 4px rgba(0, 0, 0, 0.4);
        transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        border: 2px solid var(--bg-panel);
    }

    input[type=range]::-webkit-slider-thumb:hover {
        transform: scale(1.25);
        box-shadow: 0 0 20px var(--accent-glow), 0 4px 8px rgba(0, 0, 0, 0.5);
    }

    /* TEXT INPUT */
    .input-wrapper { width: 100%; }

    .text-input-styled {
        width: 100%;
        background: var(--bg-input);
        border: 1px solid var(--border-subtle);
        color: var(--text-bright);
        padding: 11px 14px;
        font-size: 13px;
        border-radius: var(--radius-sm);
        font-family: 'JetBrains Mono', monospace;
        font-weight: 500;
        transition: all 0.25s;
        box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.4);
    }

    .text-input-styled:focus {
        border-color: var(--accent);
        background: var(--bg-panel);
        box-shadow: 0 0 0 3px var(--accent-dim), inset 0 1px 3px rgba(0, 0, 0, 0.2);
    }

    .text-input-styled::placeholder {
        color: var(--text-muted);
    }

    /* KEYBIND BUTTON */
    .keybind-btn {
        background: var(--bg-input);
        border: 1px solid var(--border-subtle);
        color: var(--text-bright);
        padding: 8px 18px;
        border-radius: var(--radius-sm);
        font-family: 'JetBrains Mono', monospace;
        font-size: 12px;
        font-weight: 700;
        cursor: pointer;
        min-width: 60px;
        text-align: center;
        transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
        text-transform: uppercase;
        letter-spacing: 1px;
        box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.4);
    }

    .keybind-btn:hover {
        background: var(--bg-panel);
        border-color: var(--accent);
        transform: translateY(-1px);
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
    }

    .keybind-btn.recording {
        background: var(--accent);
        color: var(--text-white);
        border-color: var(--accent-bright);
        box-shadow: 0 0 20px var(--accent-glow), 0 4px 12px rgba(0, 0, 0, 0.4);
        animation: recordPulse 1.5s infinite;
    }

    @keyframes recordPulse {
        0%, 100% { opacity: 1; transform: scale(1); }
        50% { opacity: 0.8; transform: scale(1.02); }
    }

    /* THEME GRID */
    .theme-grid {
        display: grid;
        grid-template-columns: repeat(5, 1fr);
        gap: 12px;
        width: 100%;
        padding: 18px 22px;
    }

    .theme-btn {
        height: 50px;
        border-radius: var(--radius-md);
        cursor: pointer;
        border: 2px solid var(--border-subtle);
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        position: relative;
        overflow: hidden;
        box-shadow: var(--shadow-sm);
    }

    .theme-btn::before {
        content: '';
        position: absolute;
        inset: 0;
        background: inherit;
        transition: all 0.3s;
    }

    .theme-btn:hover {
        transform: translateY(-4px) scale(1.05);
        box-shadow: var(--shadow-md), 0 0 20px var(--accent-glow);
    }

    .theme-btn.active {
        border-color: var(--text-white);
        box-shadow: 0 0 0 3px var(--accent-dim), var(--shadow-md);
    }

    .theme-btn.active::after {
        content: '✓';
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        color: white;
        font-size: 20px;
        font-weight: 900;
        text-shadow: 0 2px 8px rgba(0, 0, 0, 0.8);
    }

    .tb-def { background: linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #4c1d95 100%); }
    .tb-nvg { background: linear-gradient(135deg, #064e3b 0%, #065f46 50%, #047857 100%); }
    .tb-ice { background: linear-gradient(135deg, #0c4a6e 0%, #075985 50%, #0284c7 100%); }
    .tb-red { background: linear-gradient(135deg, #7f1d1d 0%, #991b1b 50%, #b91c1c 100%); }
    .tb-void { background: linear-gradient(135deg, #581c87 0%, #6b21a8 50%, #7e22ce 100%); }
`;

    const styleSheet = document.createElement('style');
    styleSheet.textContent = styles;
    document.head.appendChild(styleSheet);

    // =========================================================================
    //  >>> HTML STRUCTURE <<<
    // =========================================================================

    const html = `
        <div class="rageok-root active">
            <div class="rageok-sidebar">
                <div class="rageok-logo">
                    <h1>NAMEHERE</h1>
                    <span>rageok</span>
                </div>
                <div class="nav-container">
                    <div class="nav-item active" data-tab="keybinds">
                        <svg viewBox="0 0 24 24"><path d="M20 5H4c-1.1 0-1.99.9-1.99 2L2 17c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm-9 3h2v2h-2V8zm0 3h2v2h-2v-2zM8 8h2v2H8V8zm0 3h2v2H8v-2zm-1 2H5v-2h2v2zm0-3H5V8h2v2zm9 7H8v-2h8v2zm0-4h-2v-2h2v2zm0-3h-2V8h2v2zm3 3h-2v-2h2v2zm0-3h-2V8h2v2z"/></svg>
                        Keybinds
                    </div>
                    <div class="nav-item" data-tab="combat">
                        <svg viewBox="0 0 24 24"><path d="M7 22h13v-5l-4-3l-2 3h-3v-6l-3-4l-8 5v2l6 3v5z"/></svg>
                        Combat
                    </div>
                    <div class="nav-item" data-tab="defense">
                        <svg viewBox="0 0 24 24"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12c5.16-1.26 9-6.45 9-12V5l-9-4z"/></svg>
                        Defense
                    </div>
                    <div class="nav-item" data-tab="placers">
                        <svg viewBox="0 0 24 24"><path d="M4 8h4V4H4v4zm6 12h4v-4h-4v4zm-6 0h4v-4H4v4zm0-6h4v-4H4v4zm6 0h4v-4h-4v4zm6-10v4h4V4h-4zm-6 4h4V4h-4v4zm6 6h4v-4h-4v4zm0 6h4v-4h-4v4z"/></svg>
                        Placers
                    </div>
                    <div class="nav-item" data-tab="utilities">
                        <svg viewBox="0 0 24 24"><path d="M22.7 19l-9.1-9.1c.9-2.3.4-5-1.5-6.9c-2-2-5-2.4-7.4-1.3L9 6L6 9L1.6 4.7C.4 7.1.9 10.1 2.9 12.1c1.9 1.9 4.6 2.4 6.9 1.5l9.1 9.1c.4.4 1 .4 1.4 0l2.3-2.3c.5-.4.5-1.1.1-1.4z"/></svg>
                        Utilities
                    </div>
                    <div class="nav-item" data-tab="misc">
                        <svg viewBox="0 0 24 24"><path d="M3 17v2h6v-2H3zM3 5v2h10V5H3zm10 16v-2h8v-2h-8v-2h-2v6h2zM7 9v2H3v2h4v2h2V9H7zm14 4v-2H11v2h10zm-6-4h2V7h4V5h-4V3h-2v6z"/></svg>
                        Misc
                    </div>
                    <div class="nav-item" data-tab="visuals">
                        <svg viewBox="0 0 24 24"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5z"/></svg>
                        Visuals
                    </div>
                    <div class="nav-item" data-tab="menu">
                        <svg viewBox="0 0 24 24"><path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"/></svg>
                        Menu Settings
                    </div>
                    <div class="nav-item" data-tab="bots">
                        <svg viewBox="0 0 24 24"><path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1H2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2M9 9a3 3 0 0 0-3 3v4a3 3 0 0 0 3 3h6a3 3 0 0 0 3-3v-4a3 3 0 0 0-3-3H9m0 2h6a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1v-4a1 1 0 0 1 1-1m0 1a1 1 0 1 0 0 2 1 1 0 0 0 0-2m6 0a1 1 0 1 0 0 2 1 1 0 0 0 0-2"/></svg>
                        Bots
                    </div>
                </div>
            </div>
            <div class="rageok-main">
                <div class="rageok-header">
                    <div class="header-title">Keybind Settings</div>
                    <div class="search-wrap">
                        <input type="text" class="search-input" placeholder="Search settings...">
                    </div>
                </div>
                <div class="rageok-content"></div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', html);

    const root = document.querySelector('.rageok-root');
    const content = document.querySelector('.rageok-content');
    const headerTitle = document.querySelector('.header-title');
    const searchInput = document.querySelector('.search-input');

    // Apply saved theme
    if (window.vars.theme) {
        root.classList.add(window.vars.theme);
    }

    let currentTab = 'keybinds';

    function render(tab, searchResults = null) {
        content.innerHTML = '';

        // Handle bots-mode class
        if (tab === 'bots' && !searchResults) {
            content.classList.add('bots-mode');
            headerTitle.innerText = 'Bot Manager';
            currentTab = 'bots';
            if (window.renderBotsTab) window.renderBotsTab(content);
            return;
        } else {
            content.classList.remove('bots-mode');
        }

        if (searchResults) {
            headerTitle.innerText = `Search Results`;
            var sections = searchResults;
        } else {
            const tabNames = {
                keybinds: 'Keybind Settings',
                combat: 'Combat Settings',
                defense: 'Defense Settings',
                placers: 'Placers Settings',
                utilities: 'Utilities Settings',
                misc: 'Miscellaneous',
                visuals: 'Visuals Settings',
                menu: 'Menu Settings',
                bots: 'Bot Manager'
            };
            headerTitle.innerText = tabNames[tab] || 'Settings';
            currentTab = tab;
            var sections = MenuConfig[tab] || [];
        }

        if (sections.length === 0) {
            content.innerHTML = `<div style="padding:30px; color:var(--text-dim); font-size:14px; grid-column: 1 / -1; text-align: center;">No settings found.</div>`;
            return;
        }

        sections.forEach(sec => {
            const card = document.createElement('div');
            card.className = 'rageok-card';

            let itemsContainer = document.createElement('div');

            sec.items.forEach(item => {
                if (item.type === 'toggle') {
                    const row = document.createElement('div');
                    row.className = 'feature-row';
                    row.innerHTML = `<span class="feat-label">${item.name}</span>`;

                    const isActive = window.vars[item.id];
                    const switchEl = document.createElement('div');
                    switchEl.className = `switch ${isActive ? 'active' : ''}`;
                    switchEl.innerHTML = `<div class="knob"></div>`;

                    switchEl.onclick = () => {
                        window.vars[item.id] = !window.vars[item.id];
                        switchEl.classList.toggle('active');
                        saveConfig();
                    };

                    row.appendChild(switchEl);
                    itemsContainer.appendChild(row);
                }
                else if (item.type === 'slider') {
                    const row = document.createElement('div');
                    row.className = 'feature-row stacked';
                    row.innerHTML = `<span class="feat-label">${item.name}</span>`;

                    const wrap = document.createElement('div');
                    wrap.className = 'slider-wrapper';

                    const val = window.vars[item.id];
                    const input = document.createElement('input');
                    input.type = 'range';
                    input.min = item.min;
                    input.max = item.max;
                    input.value = val;

                    input.addEventListener('keydown', (e) => { e.stopPropagation(); e.stopImmediatePropagation(); }, true);
                    input.addEventListener('keyup', (e) => { e.stopPropagation(); e.stopImmediatePropagation(); }, true);

                    const valDisplay = document.createElement('span');
                    valDisplay.className = 'slider-val';
                    valDisplay.innerText = val;

                    input.oninput = (e) => {
                        window.vars[item.id] = parseInt(e.target.value);
                        valDisplay.innerText = window.vars[item.id];
                        saveConfig();
                    };

                    wrap.appendChild(input);
                    wrap.appendChild(valDisplay);
                    row.appendChild(wrap);
                    itemsContainer.appendChild(row);
                }
                else if (item.type === 'input') {
                    const row = document.createElement('div');
                    row.className = 'feature-row stacked';
                    row.innerHTML = `<span class="feat-label">${item.name}</span>`;

                    const wrap = document.createElement('div');
                    wrap.className = 'input-wrapper';

                    const input = document.createElement('input');
                    input.type = 'text';
                    input.className = 'text-input-styled';
                    input.value = window.vars[item.id];

                    input.addEventListener('keydown', (e) => { e.stopPropagation(); e.stopImmediatePropagation(); }, true);
                    input.addEventListener('keyup', (e) => { e.stopPropagation(); e.stopImmediatePropagation(); }, true);

                    input.oninput = (e) => {
                        window.vars[item.id] = e.target.value;
                        saveConfig();
                    };

                    wrap.appendChild(input);
                    row.appendChild(wrap);
                    itemsContainer.appendChild(row);
                }
                else if (item.type === 'keybind') {
                    const row = document.createElement('div');
                    row.className = 'feature-row';
                    row.innerHTML = `<span class="feat-label">${item.name}</span>`;

                    const btn = document.createElement('button');
                    btn.className = 'keybind-btn';
                    btn.innerText = window.vars[item.id];

                    btn.onclick = () => {
                        btn.innerText = "...";
                        btn.classList.add('recording');

                        const keyHandler = (e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            e.stopImmediatePropagation();

                            let code = e.code;
                            if (code.startsWith('Key')) code = code.slice(3);
                            if (code.startsWith('Digit')) code = code.slice(5);

                            if (e.key === 'Escape') {
                                btn.innerText = window.vars[item.id];
                                btn.classList.remove('recording');
                                window.removeEventListener('keydown', keyHandler, true);
                                return;
                            }

                            window.vars[item.id] = code.toUpperCase();
                            btn.innerText = window.vars[item.id];
                            btn.classList.remove('recording');
                            saveConfig();

                            window.removeEventListener('keydown', keyHandler, true);
                        };

                        // Use capture=true so we intercept BEFORE the game's listener
                        window.addEventListener('keydown', keyHandler, true);
                    };

                    row.appendChild(btn);
                    itemsContainer.appendChild(row);
                }
                else if (item.type === 'theme_select') {
                    const themes = [
                        { name: 'Default', cls: 'tb-def', val: '' },
                        { name: 'Nightvision', cls: 'tb-nvg', val: 't-nvg' },
                        { name: 'Glacier', cls: 'tb-ice', val: 't-ice' },
                        { name: 'Crimson', cls: 'tb-red', val: 't-red' },
                        { name: 'Amethyst', cls: 'tb-void', val: 't-void' }
                    ];

                    const grid = document.createElement('div');
                    grid.className = 'theme-grid';

                    themes.forEach(t => {
                        const btn = document.createElement('div');
                        btn.className = `theme-btn ${t.cls} ${window.vars[item.id] === t.val ? 'active' : ''}`;
                        btn.title = t.name;

                        btn.onclick = () => {
                            grid.querySelectorAll('.theme-btn').forEach(b => b.classList.remove('active'));
                            btn.classList.add('active');

                            root.classList.remove('t-nvg', 't-ice', 't-red', 't-void');
                            if (t.val) root.classList.add(t.val);

                            window.vars[item.id] = t.val;
                            saveConfig();
                        };

                        grid.appendChild(btn);
                    });
                    itemsContainer.appendChild(grid);
                }
            });

            const title = document.createElement('div');
            title.className = 'card-title';
            title.innerText = sec.title;

            card.appendChild(title);
            card.appendChild(itemsContainer);
            content.appendChild(card);
        });
    }

    searchInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase().trim();
        if (!query) { render(currentTab); return; }
        let itemsFound = [];
        Object.keys(MenuConfig).forEach(tab => {
            MenuConfig[tab].forEach(sec => {
                sec.items.forEach(item => {
                    if (item.name && item.name.toLowerCase().includes(query)) itemsFound.push(item);
                });
            });
        });
        if (itemsFound.length > 0) render(null, [{ title: "Search Results", items: itemsFound }]);
    });

    document.querySelectorAll('.nav-item').forEach(btn => {
        btn.onclick = () => {
            searchInput.value = '';
            document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            render(btn.dataset.tab);
        };
    });

    document.addEventListener('keydown', e => {
        if (e.code === 'Insert' || e.code === 'Escape') root.classList.toggle('active');
    });

    render('keybinds');

    function cycleUsername() {
        if (!window.vars.usernameCycler) return;

        const names = (window.vars.usernameList || '')
        .split(',')
        .map(n => n.trim())
        .filter(Boolean);

        if (!names.length) return;

        window.vars.usernameIndex = (window.vars.usernameIndex + 1) % names.length;
        const nextName = names[window.vars.usernameIndex];

        const nameInput = document.getElementById('nameInput');
        if (nameInput) {
            nameInput.value = nextName;
            nameInput.dispatchEvent(new Event('input', { bubbles: true }));
            nameInput.dispatchEvent(new Event('change', { bubbles: true }));
        }

        saveConfig();
    }

    function handleSpawn(e) {
        const nameInput = document.getElementById('nameInput');
        const isEnterKey = e.type === 'keydown' && e.code === 'Enter';
        const isButtonClick = e.type === 'click' && e.target?.id === 'enterGame';

        if ((isEnterKey || isButtonClick) && nameInput?.offsetParent) {
            cycleUsername();
        }
    }

    document.addEventListener('keydown', handleSpawn, true);
    document.addEventListener('click', handleSpawn, true);

})();
(function() {
    const rainCanvas = document.createElement('canvas');
    const rainCtx = rainCanvas.getContext('2d');
    rainCanvas.id = 'rainCanvas';
    rainCanvas.style.position = 'fixed';
    rainCanvas.style.top = '0';
    rainCanvas.style.left = '0';
    rainCanvas.style.pointerEvents = 'none'; // Чтобы не мешал кликам
    rainCanvas.style.zIndex = '10';
    document.body.appendChild(rainCanvas);

    let width, height;
    const raindrops = [];
    const rainCount = 300; // Увеличено количество капель для плотного дождя

    function resize() {
        width = rainCanvas.width = window.innerWidth;
        height = rainCanvas.height = window.innerHeight;
    }

    window.addEventListener('resize', resize);
    resize();

    class Raindrop {
        constructor() {
            this.init(true);
        }
        init(firstTime = false) {
            this.x = Math.random() * (width + 200); // Запас для наклона
            this.y = firstTime ? Math.random() * height : Math.random() * -height;
            this.length = Math.random() * 25 + 20;
            this.speed = Math.random() * 2 + 5;
            this.opacity = Math.random() * 0.3 + 0.1;
        }
        draw() {
            rainCtx.beginPath();
            rainCtx.strokeStyle = `rgba(70, 130, 180, ${this.opacity})`;
            rainCtx.lineWidth = 1.2;
            rainCtx.moveTo(this.x, this.y);
            // Наклон капли (ветер)
            rainCtx.lineTo(this.x - (this.speed * 0.15), this.y + this.length);
            rainCtx.stroke();
        }
        update() {
            this.y += this.speed;
            this.x -= this.speed * 0.15; // Движение по диагонали
            if (this.y > height || this.x < -50) this.init();
        }
    }

    // Создаем капли
    for (let i = 0; i < rainCount; i++) {
        raindrops.push(new Raindrop());
    }

    function animateRain() {
        rainCtx.clearRect(0, 0, width, height);
        for (let i = 0; i < raindrops.length; i++) {
            raindrops[i].update();
            raindrops[i].draw();
        }
        requestAnimationFrame(animateRain);
    }
    animateRain();
})();
// ============================================================
// BOT SYSTEM — Final clean implementation
// ============================================================

(function() {
    'use strict';

    // ── State ─────────────────────────────────────────────────────
    window._bots              = window._bots              || [];
    window._botIdCounter      = window._botIdCounter      || 1;
    window._botCustomName     = window._botCustomName     || '';
    window._botAutoMill       = window._botAutoMill       || false;
    window._botMillCount      = window._botMillCount      || 0;
    window._botBehavior       = window._botBehavior       || 'follow';
    window._botAutoAim        = window._botAutoAim        !== undefined ? window._botAutoAim  : true;
    window._botAutoHeal       = window._botAutoHeal       !== undefined ? window._botAutoHeal : true;
    window._botFollowRange    = window._botFollowRange    || 100;
    window._botCircleRadius   = window._botCircleRadius   || 250;
    window._botCircleRotation = window._botCircleRotation || false;
    window._botLoadout        = window._botLoadout        || 1;
    window._botPlatformDefend = window._botPlatformDefend || false;
    window._circleOff         = window._circleOff         || 0;
    window._botMouseX         = 0;
    window._botMouseY         = 0;

    // Item indices in myPlayer.items array (fixed order regardless of age)

    // ── Packet sender ─────────────────────────────────────────────
    function _bs(bot, type, ...args) {
        if (!bot.ws || bot.ws.readyState !== 1) return;
        try {
            if (bot.Z && bot.Z.mode === window._botEnc.Ht) {
                const s = bot.Z.tables.c2s.enc[type];
                if (s === undefined) return;
                const n = ++bot.Z.seq;
                const a = window.msgpack.encode([s, args, n]);
                const o = window._botEnc.Eo(bot.Z.key, a);
                const d = new Uint8Array(window._botEnc.jt + a.length);
                d.set(o, 0);
                d.set(a, window._botEnc.jt);
                bot.ws.send(d);
                return;
            }
            bot.ws.send(window.msgpack.encode([type, args]));
        } catch(e) {}
    }

    // ── Place item using fixed action bar index ──────────────────
    // 'z' packet: "z", index, false  where index = position in myPlayer.items[]
    // myPlayer.items[0]=food, [1]=wall, [2]=spike, [3]=windmill (server-fixed order)
    const _ITEM_IDX = { food:0, wall:1, spike:2, mill:3 };

    function _botPlace(bot, group, angle) {
        const idx = _ITEM_IDX[group];
        if (idx === undefined) return;
        _bs(bot, 'z', idx, false);   // selectToBuild(idx)
        setTimeout(() => {
            if (!bot.alive) return;
            _bs(bot, 'F', 1, angle);
            setTimeout(() => {
                if (!bot.alive) return;
                _bs(bot, 'F', 0, null);
            }, 80);
        }, 50);
    }

    // ── Move helpers ──────────────────────────────────────────────
    function _botMove(bot, angle) {
        if (bot._lastAng === angle) return;
        _bs(bot, '9', angle);
        bot._lastAng = angle;
        bot._stopped = false;
        bot._revAng = angle + Math.PI;
    }

    function _botStop(bot) {
        if (bot._stopped) return;
        _bs(bot, 'e');
        bot._stopped = true;
        bot._lastAng = null;
    }

    // ── Nearest enemy ─────────────────────────────────────────────
    function _nearestEnemy(bx, by) {
        const me = window._myPlayer;
        if (!me) return null;
        const ps = window._players || [];
        let best = null, minD = Infinity;
        for (let i = 0; i < ps.length; i++) {
            const p = ps[i];
            if (!p || !p.visible) continue;
            if (p === me || p.sid === me.sid) continue;
            if (me.team && p.team && p.team === me.team) continue;
            const ex = p.x2 !== undefined ? p.x2 : p.x;
            const ey = p.y2 !== undefined ? p.y2 : p.y;
            const d = Math.hypot(ex - bx, ey - by);
            if (d < minD) { minD = d; best = { ex, ey, d }; }
        }
        return best;
    }

    // ── Main tick ─────────────────────────────────────────────────
    function _botTick(bot) {
        if (!bot.alive || !bot.inGame) return;
        const me = window._myPlayer;
        if (!me) return;

        const ox = me.x2 !== undefined ? me.x2 : (me.x || 0);
        const oy = me.y2 !== undefined ? me.y2 : (me.y || 0);
        const bx = bot.x !== undefined ? bot.x : ox;
        const by = bot.y !== undefined ? bot.y : oy;

        // ── Auto Mill ─────────────────────────────────────────────
        if (window._botAutoMill && window._botMillCount < 110) {
            _botMillTick(bot, bx, by);
            return;
        }

        // ── Movement ──────────────────────────────────────────────
        const behavior = window._botBehavior || 'follow';
        let tx = ox, ty = oy;

        if (behavior === 'orbit') {
            const total = Math.max(window._bots.length, 1);
            const ang = 2 * Math.PI * window._bots.indexOf(bot) / total + (window._circleOff || 0);
            tx = ox + Math.cos(ang) * (window._botCircleRadius || 250);
            ty = oy + Math.sin(ang) * (window._botCircleRadius || 250);
        } else if (behavior === 'mouse') {
            tx = window._botMouseX || ox;
            ty = window._botMouseY || oy;
        }

        const dx = tx - bx, dy = ty - by;
        const dist = Math.hypot(dx, dy);
        if (dist > (window._botFollowRange || 100)) {
            _botMove(bot, Math.atan2(dy, dx));
        } else {
            _botStop(bot);
        }

        // ── Look direction ────────────────────────────────────────
        const ownerD = me.d2 !== undefined ? me.d2 : (me.angle || 0);
        if (Math.abs((bot._lastD || 0) - ownerD) > 0.15) {
            _bs(bot, 'D', ownerD);
            bot._lastD = ownerD;
        }

        // ── Auto aim ─────────────────────────────────────────────
        if (window._botAutoAim) {
            const en = _nearestEnemy(bx, by);
            if (en && en.d < 250) {
                const aim = Math.atan2(en.ey - by, en.ex - bx);
                _bs(bot, 'D', aim);
                const now = Date.now();
                if (!bot._atkT || now - bot._atkT > 800) {
                    _bs(bot, 'F', 1, aim);
                    setTimeout(() => { if (bot.alive) _bs(bot, 'F', 0, null); }, 80);
                    bot._atkT = now;
                }
            }
        }

        // ── Auto heal (same as player's heal() function) ────────────
        if (window._botAutoHeal && bot.health !== undefined && bot.health < 100) {
            const now = Date.now();
            if (!bot._healT || now - bot._healT > 500) {
                bot._healT = now;
                const me = window._myPlayer;
                // Use same food item as player (myPlayer.items[0])
                const foodId = (me && me.items && me.items[0] !== undefined) ? me.items[0] : 0;
                const wepId  = (me && me.weapons && me.weapons[0] !== undefined) ? me.weapons[0] : 0;
                _bs(bot, 'z', foodId, false); // selectToBuild(id)
                setTimeout(() => {
                    if (!bot.alive) return;
                    _bs(bot, 'F', 1, null);   // sendAtck(1)
                    _bs(bot, 'F', 0, null);   // sendAtck(0)
                    setTimeout(() => {
                        if (bot.alive) _bs(bot, 'z', wepId, true); // selectWeapon
                    }, 50);
                }, 30);
            }
        }
    }

    // ── Auto mill tick ────────────────────────────────────────────
    function _botMillTick(bot, bx, by) {
        const now = Date.now();
        if (window._botMillCount >= 110) { _botStop(bot); return; }

        // Pick wander target
        if (!bot._mX || now - (bot._mT || 0) > 2500) {
            bot._mT = now;
            let best = -9999, bX = bx + 900, bY = by;
            for (let i = 0; i < 12; i++) {
                const a = (i / 12) * Math.PI * 2 + Math.random() * 0.3;
                const d = 800 + Math.random() * 600;
                const tx = bx + Math.cos(a) * d, ty = by + Math.sin(a) * d;
                if (tx < 300 || tx > 14100 || ty < 300 || ty > 14100) continue;
                let sc = 10;
                window._bots.forEach(b => {
                    if (b === bot || b.x === undefined) return;
                    const bd = Math.hypot(tx - b.x, ty - b.y);
                    if (bd < 500) sc -= (1 - bd / 500) * 4;
                });
                if (sc > best) { best = sc; bX = tx; bY = ty; }
            }
            bot._mX = bX; bot._mY = bY;
        }

        // Move
        const wdx = bot._mX - bx, wdy = bot._mY - by, wdd = Math.hypot(wdx, wdy);
        if (wdd > 80) {
            const ma = Math.atan2(wdy, wdx);
            _botMove(bot, ma);
            _bs(bot, 'D', ma);
            bot._revAng = ma + Math.PI;
        } else {
            _botStop(bot);
            bot._mX = null;
        }

        // Place windmill every 800ms
        if (!bot._mPT || now - bot._mPT > 800) {
            bot._mPT = now;
            const rev = bot._revAng !== undefined ? bot._revAng : Math.PI;
            _botPlace(bot, 'mill', rev);
            window._botMillCount++;
        }
    }

    // ── io.send hook ──────────────────────────────────────────────
    (function _hookWait() {
        const io = window._gameIO;
        if (!io || !io.send) { setTimeout(_hookWait, 300); return; }
        if (io._bh) return;
        io._bh = true;
        const orig = io.send;
        io.send = function() {
            orig.apply(this, arguments);
            const t = arguments[0];
            const a = Array.prototype.slice.call(arguments, 1);
            const bots = window._bots;
            if (!bots || !bots.length) return;
            const now = Date.now();
            switch(t) {
                case 'F': // attack/place — always mirror
                    bots.forEach(b => { if(b.alive && b.inGame) _bs(b, 'F', a[0], a[1]); });
                    break;
                case 'H': // upgrade — disabled, causes kick with wrong IDs
                    break;
                case 'D': // look — throttled mirror
                    if (!window._lastMD || now - window._lastMD > 150) {
                        window._lastMD = now;
                        bots.forEach(b => { if(b.alive && b.inGame) _bs(b, 'D', a[0]); });
                    }
                    break;
                case '9': window._pMoveAng = a[0]; break;
                case 'e': window._pMoveAng = null; break;
            }
        };
    })();

    // ── Platform defend ───────────────────────────────────────────
    document.addEventListener('keydown', e => {
        if (e.code !== 'KeyG' || !window._botPlatformDefend) return;
        window._bots.forEach(bot => {
            if (!bot.alive || !bot.inGame) return;
            [0, Math.PI/2, Math.PI, -Math.PI/2].forEach((ang, i) => {
                setTimeout(() => _botPlace(bot, 'wall', ang), i * 120);
            });
        });
    }, true);

    // ── Mouse tracking ────────────────────────────────────────────
    document.addEventListener('mousemove', e => {
        const me = window._myPlayer;
        if (!me) return;
        const s = (window.config && window.config.playerScale) || 35;
        const c = document.getElementById('gameCanvas');
        if (!c) return;
        const r = c.getBoundingClientRect();
        window._botMouseX = (me.x2||me.x||0) + (e.clientX - r.left - r.width/2) / s;
        window._botMouseY = (me.y2||me.y||0) + (e.clientY - r.top - r.height/2) / s;
    }, { passive: true });

    // ── Circle rotation ───────────────────────────────────────────
    setInterval(() => {
        if (window._botCircleRotation) {
            window._circleOff = ((window._circleOff||0) + 65/(window._botCircleRadius||250)) % (Math.PI*2);
        }
    }, 50);

    // ── Clan sync ─────────────────────────────────────────────────
    setInterval(() => {
        const me = window._myPlayer;
        if (!me || !window._bots) return;
        const ot = me.team || null;
        window._bots.forEach(bot => {
            if (!bot.alive || !bot.inGame) return;
            if ((bot.team||null) === ot) return;
            if (bot.team) { _bs(bot, 'N'); bot.team = null; }
            if (ot) {
                const c = (window._alliances||[]).find(c => c && c.sid === ot);
                setTimeout(() => { if(bot.alive) { _bs(bot,'b',c?c.sid:me.sid); bot.team=ot; } }, 500);
            }
        });
    }, 1000);

    // ── 10Hz tick ─────────────────────────────────────────────────
    setInterval(() => {
        if (!window._bots) return;
        window._bots.forEach(_botTick);
    }, 100);

    // ── Remove ────────────────────────────────────────────────────
    function _removeBot(id) {
        const bot = window._bots.find(b => b.id === id);
        if (!bot) return;
        clearInterval(bot._pingInterval);
        try { bot.ws && bot.ws.close(); } catch(e) {}
        window._bots = window._bots.filter(b => b.id !== id);
        _updateBotsList();
    }
    window._removeBot = _removeBot;

    function _removeAllBots() {
        window._bots.forEach(b => {
            clearInterval(b._pingInterval);
            try { b.ws && b.ws.close(); } catch(e) {}
        });
        window._bots = [];
        _updateBotsList();
    }

    // ── Update UI list ────────────────────────────────────────────
    function _updateBotsList() {
        const list = document.getElementById('_bots-list');
        const countEl = document.getElementById('_bots-count');
        if (!list || !countEl) return;
        const total = window._bots.length;
        const active = window._bots.filter(b => b.inGame).length;
        countEl.textContent = `${total} bots (${active} in game)`;
        list.innerHTML = '';
        if (total === 0) {
            list.innerHTML = '<div style="color:var(--text-dim);font-size:13px;padding:8px 0;">No bots</div>';
            return;
        }
        window._bots.forEach(bot => {
            const row = document.createElement('div');
            row.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:6px 10px;border-radius:8px;background:var(--bg-dark);margin-bottom:4px;';
            row.innerHTML = `<span style="color:${bot.inGame?'#7aff7a':'#ffaa44'};font-size:13px;font-weight:600;">${bot.inGame?'●':'○'} ${bot.name} <span style="color:var(--text-dim);font-size:11px;">age${bot.age||1}</span></span><button onclick="window._removeBot(${bot.id})" style="background:#3f1515;border:1px solid #7f2020;color:#f87171;border-radius:6px;padding:2px 8px;cursor:pointer;font-size:12px;">✕</button>`;
            list.appendChild(row);
        });
    }

    // ── Create bot ────────────────────────────────────────────────
    function _getServerUrl() {
        try {
            if (window._wsAddress) return window._wsAddress;
            if (typeof wsAddress !== 'undefined' && wsAddress) return wsAddress;
        } catch(e) {}
        return null;
    }

    async function _createBotAsync(customName) {
        const serverUrl = _getServerUrl();
        if (!serverUrl) { alert('Join a game first!'); return null; }

        let url = serverUrl;
        // Use the captured Turnstile token
        if (typeof capturedToken !== 'undefined' && capturedToken) {
            try {
                const u = new URL(serverUrl);
                u.searchParams.set('token', "cf:" + capturedToken);
                url = u.toString();
            } catch(e) {}
        }

        const botId = window._botIdCounter++;
        const bot = {
            id: botId,
            name: customName || window._botCustomName || ('Bot' + botId),
            ws: null, alive: false, inGame: false,
            age: 1, sid: null, clientID: null,
            x: undefined, y: undefined,
            health: 100, team: null,
            _pingInterval: null,
            Z: null // Add encryption state
        };

        const WS = window.OriginalWebSocket || window.WebSocket;
        let ws;
        try { ws = new WS(url); } catch(e) { alert('WS failed: ' + e.message); return null; }
        ws.binaryType = 'arraybuffer';
        bot.ws = ws;
        window._bots.push(bot);
        _updateBotsList();

        ws.onopen = () => {
            console.log('[BOT] opened! url:', ws.url.slice(0,80));
            bot.alive = true;
            _bs(bot, '0');
            bot._pingInterval = setInterval(() => {
                if (!bot.alive || ws.readyState !== 1) { clearInterval(bot._pingInterval); return; }
                _bs(bot, '0');
            }, 2000);
        };

        ws.onmessage = (e) => {
            try {
                const p = window.msgpack.decode(new Uint8Array(e.data));
                let type = p[0];
                const args = p[1];

                if (type === 'io-init') {
                    bot.clientID = Array.isArray(args) ? args[0] : args;
                    bot.sid = bot.clientID;

                    if (args[3] === window._botEnc.Ht) {
                        bot.Z = {
                            mode: window._botEnc.Ht,
                            key: window._botEnc.Ro(args[2]),
                            tables: window._botEnc.Po(args[1] >>> 0),
                            seq: 0
                        };
                    } else {
                        bot.Z = null;
                    }

                    _bs(bot, '0');
                    const skin = Number(localStorage.getItem('skin_color')) || 0;
                    const sk = skin === 10 ? 'constructor' : skin;
                    _bs(bot, 'M', { name: bot.name, moofoll: 1, skin: sk });
                    return;
                }

                if (bot.Z && typeof type === "number") {
                    type = bot.Z.tables.s2c.dec[type];
                    if (type === undefined) return;
                }

                switch(type) {
                    case 'C':
                        { const ns = Array.isArray(args) ? args[0] : args;
                         if (typeof ns === 'number') bot.sid = ns; }
                        bot.inGame = true;
                        bot._logStart = Date.now();
                        _updateBotsList();
                        break;
                    case 'T':
                        // Glotus: temp=[T, xp, maxXp, age], if temp.length===4 → age=temp[3]
                        // temp[1]=args[0], so age=args[2]
                        { const age = Array.isArray(args) && args.length >= 3 ? args[2] : (Array.isArray(args) ? args[0] : args);
                         if (typeof age === 'number' && age > 0) bot.age = age; }
                        break;
                    case 'a': {
                        // flat array per player: [sid,x,y,dir,...] stride 13
                        const d = args[0];
                        if (Array.isArray(d) && bot.sid !== null) {
                            for (let i = 0; i < d.length; i += 13) {
                                if (d[i] === bot.sid) {
                                    bot.x = d[i+1]; bot.y = d[i+2];
                                    break;
                                }
                            }
                        }
                        break;
                    }
                    case 'O': {
                        // args=[sid, health] — update if this is our bot
                        if (Array.isArray(args) && args[0] === bot.sid) {
                            bot.health = args[1];
                        }
                        break;
                    }
                    case 'S':
                        // Glotus: myPlayer.updateItemCount(temp[1], temp[2]) - not health
                        break;
                    case '2':
                        // clan join request — auto accept
                        if (Array.isArray(args)) _bs(bot, 'P', args[0], 1);
                        break;
                    case 'P':
                        bot.inGame = false; bot.age = 1;
                        _updateBotsList();
                        setTimeout(() => {
                            if (bot.alive) {
                                const skin = Number(localStorage.getItem('skin_color')) || 0;
                                const sk = skin === 10 ? 'constructor' : skin;
                                _bs(bot, 'M', { name: bot.name, moofoll: 1, skin: sk });
                            }
                        }, 2000);
                        break;
                    case '0': break; // pong handled by setInterval
                }
            } catch(err) {}
        };

        ws.onclose = (e) => {
            console.log('[BOT] close:', e.code, e.reason, 'wasClean:', e.wasClean);
            bot.alive = false; bot.inGame = false;
            clearInterval(bot._pingInterval);
            window._bots = window._bots.filter(b => b.id !== bot.id);
            _updateBotsList();
        };
        ws.onerror = (e) => { console.log('[BOT] error:', e.message||e); };


        return bot;
    }


    // ── Bot Manager UI ────────────────────────────────────────────
    window.renderBotsTab = function(container) {
        container.innerHTML = `
    <div style="padding:16px;display:flex;flex-direction:column;gap:12px;width:100%;box-sizing:border-box;">

        <div style="background:var(--bg-card);border:1px solid var(--border-normal);border-radius:12px;padding:14px;">
            <div style="color:var(--text-dim);font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">STATUS</div>
            <div id="_bots-count" style="color:var(--accent-bright);font-size:15px;font-weight:800;">0 bots (0 in game)</div>
        </div>

        <div style="background:var(--bg-card);border:1px solid var(--border-normal);border-radius:12px;padding:14px;">
            <div style="color:var(--text-dim);font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-bottom:10px;">CONTROLS</div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px;">
                <button id="_bot-add"  style="flex:1;padding:9px;background:var(--accent);border:none;color:#fff;border-radius:8px;cursor:pointer;font-weight:700;font-size:13px;">+ Add Bot</button>
                <button id="_bot-add5" style="flex:1;padding:9px;background:#4c1d95;border:none;color:#c4b5fd;border-radius:8px;cursor:pointer;font-weight:700;font-size:13px;">+ Add 5</button>
                <button id="_bot-disc" style="flex:1;padding:9px;background:#3f1515;border:1px solid #7f2020;color:#f87171;border-radius:8px;cursor:pointer;font-weight:700;font-size:13px;">Disc All</button>
            </div>
            <input id="_bot-name-input" type="text" placeholder="Bot name" value="${window._botCustomName||''}"
                style="width:100%;padding:8px 10px;border-radius:8px;border:1px solid var(--border-normal);background:var(--bg-input);color:var(--text-bright);font-size:13px;box-sizing:border-box;">
        </div>

        <div style="background:var(--bg-card);border:1px solid var(--border-normal);border-radius:12px;padding:14px;">
            <div style="color:var(--text-dim);font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-bottom:10px;">MOVEMENT</div>
            <div style="display:flex;gap:6px;margin-bottom:12px;">
                ${['follow','orbit','mouse'].map((b,i)=>`<button id="_beh-${b}" style="flex:1;padding:8px;border-radius:8px;border:2px solid ${window._botBehavior===b?'var(--accent)':'var(--border-normal)'};background:${window._botBehavior===b?'var(--accent-dim)':'transparent'};color:${window._botBehavior===b?'var(--accent-bright)':'var(--text-dim)'};cursor:pointer;font-weight:700;font-size:12px;">${['👤 Follow','🔄 Orbit','🖱 Mouse'][i]}</button>`).join('')}
            </div>
            <div style="margin-bottom:8px;">
                <div style="display:flex;justify-content:space-between;margin-bottom:3px;">
                    <span style="color:var(--text-dim);font-size:12px;">Follow Range</span>
                    <span id="_fr-val" style="color:var(--accent-bright);font-size:12px;font-weight:700;">${window._botFollowRange}px</span>
                </div>
                <input id="_fr" type="range" min="0" max="500" step="25" value="${window._botFollowRange}" style="width:100%;accent-color:var(--accent);">
            </div>
            <div style="margin-bottom:8px;">
                <div style="display:flex;justify-content:space-between;margin-bottom:3px;">
                    <span style="color:var(--text-dim);font-size:12px;">Circle Radius</span>
                    <span id="_cr-val" style="color:var(--accent-bright);font-size:12px;font-weight:700;">${window._botCircleRadius}px</span>
                </div>
                <input id="_cr" type="range" min="50" max="800" step="25" value="${window._botCircleRadius}" style="width:100%;accent-color:var(--accent);">
            </div>
            <div style="display:flex;align-items:center;justify-content:space-between;">
                <span style="color:var(--text-dim);font-size:12px;">Circle Rotation</span>
                <div id="_crot" style="width:44px;height:24px;border-radius:12px;background:${window._botCircleRotation?'var(--accent)':'var(--bg-hover)'};cursor:pointer;position:relative;">
                    <div style="width:18px;height:18px;border-radius:50%;background:#fff;position:absolute;top:3px;left:${window._botCircleRotation?'23px':'3px'};transition:left 200ms;"></div>
                </div>
            </div>
        </div>

        <div style="background:var(--bg-card);border:1px solid var(--border-normal);border-radius:12px;padding:14px;">
            <div style="color:var(--text-dim);font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-bottom:10px;">AI SETTINGS</div>
            ${[
            ['_aim',  window._botAutoAim,        'Auto Aim',     'Attack nearest enemy'],
            ['_heal', window._botAutoHeal,       'Auto Heal',    'Eat food < 80% HP'],
            ['_plat', window._botPlatformDefend, 'Platform (G)', 'G key → place walls'],
        ].map(([id,val,lbl,sub])=>`
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
                <div><div style="color:var(--text-bright);font-weight:600;font-size:13px;">${lbl}</div><div style="color:var(--text-dim);font-size:12px;">${sub}</div></div>
                <div id="${id}" style="width:44px;height:24px;border-radius:12px;background:${val?'var(--accent)':'var(--bg-hover)'};cursor:pointer;position:relative;flex-shrink:0;"><div style="width:18px;height:18px;border-radius:50%;background:#fff;position:absolute;top:3px;left:${val?'23px':'3px'};transition:left 200ms;"></div></div>
            </div>`).join('')}
        </div>

        <div style="background:var(--bg-card);border:1px solid var(--border-normal);border-radius:12px;padding:14px;">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
                <div><div style="color:var(--text-bright);font-weight:600;font-size:13px;">Auto Mill</div><div style="color:var(--text-dim);font-size:12px;">Bots place windmills</div></div>
                <div id="_mill" style="width:44px;height:24px;border-radius:12px;background:${window._botAutoMill?'var(--accent)':'var(--bg-hover)'};cursor:pointer;position:relative;">
                    <div style="width:18px;height:18px;border-radius:50%;background:#fff;position:absolute;top:3px;left:${window._botAutoMill?'23px':'3px'};transition:left 200ms;"></div>
                </div>
            </div>
            <div style="display:flex;align-items:center;justify-content:space-between;">
                <span style="color:var(--text-dim);font-size:13px;">Mills: <span id="_mc" style="color:#7aff7a;font-weight:700;">${window._botMillCount}/110</span></span>
                <button id="_mr" style="padding:4px 12px;background:var(--bg-hover);border:1px solid var(--border-normal);color:var(--text-normal);border-radius:6px;cursor:pointer;font-size:12px;">Reset</button>
            </div>
        </div>

        <div style="background:var(--bg-card);border:1px solid var(--border-normal);border-radius:12px;padding:14px;">
            <div style="color:var(--text-dim);font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-bottom:10px;">CONNECTED BOTS</div>
            <div id="_bots-list"></div>
        </div>
    </div>`;

        // Wire
        const ni = document.getElementById('_bot-name-input');
        if (ni) { ni.oninput = e => { window._botCustomName = e.target.value.trim(); }; ni.addEventListener('keydown', e => { e.stopPropagation(); e.stopImmediatePropagation(); }, true); }

        document.getElementById('_bot-add').onclick = async () => { const n=(document.getElementById('_bot-name-input')||{}).value||''; window._botCustomName=n.trim(); await _createBotAsync(n.trim()); };
        document.getElementById('_bot-add5').onclick = async () => { const n=(document.getElementById('_bot-name-input')||{}).value||''; window._botCustomName=n.trim(); for(let i=0;i<5;i++){await _createBotAsync(n.trim());await new Promise(r=>setTimeout(r,600));} };
        document.getElementById('_bot-disc').onclick = _removeAllBots;

        ['follow','orbit','mouse'].forEach(b => { const btn=document.getElementById('_beh-'+b); if(btn) btn.onclick=()=>{window._botBehavior=b;window.renderBotsTab(container);}; });

        const fr=document.getElementById('_fr'); if(fr){fr.oninput=e=>{window._botFollowRange=+e.target.value;const el=document.getElementById('_fr-val');if(el)el.textContent=window._botFollowRange+'px';};fr.addEventListener('keydown',e=>e.stopPropagation(),true);}
        const cr=document.getElementById('_cr'); if(cr){cr.oninput=e=>{window._botCircleRadius=+e.target.value;const el=document.getElementById('_cr-val');if(el)el.textContent=window._botCircleRadius+'px';};cr.addEventListener('keydown',e=>e.stopPropagation(),true);}
        document.getElementById('_crot').onclick=()=>{window._botCircleRotation=!window._botCircleRotation;window.renderBotsTab(container);};

        [['_aim','_botAutoAim'],['_heal','_botAutoHeal'],['_plat','_botPlatformDefend']].forEach(([id,prop])=>{const el=document.getElementById(id);if(el)el.onclick=()=>{window[prop]=!window[prop];window.renderBotsTab(container);};});
        document.getElementById('_mill').onclick=()=>{window._botAutoMill=!window._botAutoMill;window.renderBotsTab(container);};
        document.getElementById('_mr').onclick=()=>{window._botMillCount=0;const el=document.getElementById('_mc');if(el)el.textContent='0/110';};

        _updateBotsList();
        clearInterval(window._botsRef);
        window._botsRef=setInterval(()=>{
            if(document.getElementById('_bots-list')){_updateBotsList();const el=document.getElementById('_mc');if(el)el.textContent=window._botMillCount+'/110';}
            else clearInterval(window._botsRef);
        },1000);
    };

})(); // end IIFE



