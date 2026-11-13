// Mission data. The engine is story.js; this file is the script.
//
// Two strands: the STORY (Mamaji, yellow markers), and SIDE missions (blue markers) that
// open up after the first story mission. Titles and plots tip their hat to Hindi films
// with a twist of their own — never the real titles, lines, songs or characters — and
// everything stays family-friendly: no weapons, no blood.
//
// A mission: { id, title, strand, after, hours: [from, to] (optional), at: [x, z],
//   cast: { id: { name, kind, cap } }, giver: cast id standing at the marker, steps: [...] }
// Steps (one key decides the type):
//   { cut: [[who, text], ...] }                       letterboxed dialogue ('you' or a cast id)
//   { goto: [x, z] | () => [x, z], label, on, limit, radius }   on: 'vehicle' | 'taxi' | 'two' | 'foot' | type name
//   { pickup: id, at, line } / { dropoff: id, line }  a passenger for the taxi
//   { waitHour: [from, to], label }
//   { cargo: { name, min, icon } } / { cargo: null }  something fragile on board until cleared
//   { visit: [[x, z, label], ...], label, on, limit } several stops in any order
//   { race: [[x, z], ...], label, on, limit }         checkpoints in order, against the clock
//   { catch: 'penguin', at, label }                   chase a runaway on foot
//   { task: 'rides' | 'colour' | 'crackers', ... }    counters
//   { call: (world) => void }                         a hook into another system
//   { reward: rupees, line, also: (world) => void }

const ll = (index, lat, lon) => [(lon - index.origin.lon) * index.metresPerDegree.lon, -(lat - index.origin.lat) * index.metresPerDegree.lat];

export function buildMissions(index, home) {
  const L = (id) => index.landmarks?.find((l) => l.id === id);
  const term = L('terminus'), gw = L('gateway');
  const P = {
    // The first marker sits a short drive ahead of where the taxi starts.
    start: index.spawn ? [index.spawn.x + Math.sin(index.spawn.heading || 0) * 14, index.spawn.z + Math.cos(index.spawn.heading || 0) * 14] : [0, 0],
    crawford: ll(index, 18.9475, 72.8340),
    terminus: term ? [term.x, term.z] : ll(index, 18.9400, 72.8355),
    terminusRoad: ll(index, 18.9393, 72.8347),
    marine: ll(index, 18.9440, 72.8230),
    maidan: ll(index, 18.9395, 72.8325),
    gateway: gw ? [gw.x, gw.z] : ll(index, 18.9220, 72.8347),
    nariman: ll(index, 18.9256, 72.8242),
    churchgate: ll(index, 18.9353, 72.8274),
    fountain: ll(index, 18.9323, 72.8316),
    fortOffice: ll(index, 18.9340, 72.8365),
    kalaGhoda: ll(index, 18.9285, 72.8320),
    talkies: ll(index, 18.9711, 72.8221),
    zoo: ll(index, 18.9777, 72.8349), // the zoo's gate on Dr Ambedkar Road
    asiatic: ll(index, 18.9317, 72.8361),
    marineSouth: ll(index, 18.9262, 72.8212),
    marineMid: ll(index, 18.9370, 72.8233),
    marineNorth: ll(index, 18.9480, 72.8208),
    chowpatty: ll(index, 18.9545, 72.8130),
    hillRoad: ll(index, 19.0556, 72.8330),
    villa: ll(index, 19.0478, 72.8196),
    home: ll(index, home[0], home[1]),
  };
  const villa = (w) => { const s = w.stars?.sites?.[0]; return s?.placed ? s.world(0, 7) : P.villa; };

  const missions = [
    // ------------------------------------------------------------------ story: Naya Shehar
    {
      id: 'welcome', title: 'Mumbai Meri Jaan', strand: 'story', at: P.start, giver: 'mamaji',
      steps: [
        { cut: [['mamaji', 'Aa gaya bhanje! Welcome to Bombay. Yeh shehar sabko kuch na kuch deta hai.'], ['mamaji', 'Yeh meri purani kaali-peeli. Ab se teri. Dhyan se chalana, iski umar mujhse zyada hai.'], ['you', 'Thank you, Mamaji! Main aapko nirash nahi karunga.'], ['mamaji', 'Pehla kaam: Crawford Market se Shabbir bhai ko utha, unko Chai Terminus chhodna hai. Jaldi!']] },
        { goto: P.crawford, label: 'Pick up Shabbir bhai at Crawford Market', on: 'taxi' },
        { pickup: 'shabbir', at: P.crawford, line: 'Arre, Mamaji ka bhanja! Chal, station chal. Train nahi chhootni chahiye!' },
        { goto: P.terminus, label: 'Drop Shabbir bhai at Chhatrapati Chai Terminus', on: 'taxi', limit: 240, fail: 'Shabbir bhai missed his train!' },
        { dropoff: 'shabbir', line: 'Shabaash! Time pe pahuncha diya. Yeh le, chai-paani.' },
        { reward: 500 },
      ],
    },
    {
      id: 'sunset', title: 'Marine Drive Ki Shaam', strand: 'story', after: 'welcome', at: P.start, giver: 'mamaji',
      steps: [
        { cut: [['mamaji', 'Bhanje, Bombay aaya aur Marine Drive ki shaam nahi dekhi? Chal, mujhe le chal.'], ['mamaji', 'Suraj doobne se pehle pahunchna. Wahan ki cutting chai jaisi chai kahin nahi.']] },
        { pickup: 'mamaji', at: P.start, line: 'Chal, Queen\'s Necklace dekhte hain!' },
        { goto: P.marine, label: 'Drive Mamaji to Marine Drive (before 7:30 PM)', on: 'taxi' },
        { waitHour: [17.5, 19.5], label: 'Wait for sunset on Marine Drive (T skips an hour)' },
        { dropoff: 'mamaji', line: 'Dekh, yeh hai Mumbai. Mehnat kar, yeh shehar tera bhi hoga.' },
        { reward: 300 },
      ],
    },
    {
      id: 'firstrides', title: 'Pehli Sawaari', strand: 'story', after: 'sunset', at: P.start, giver: 'mamaji',
      steps: [
        { cut: [['mamaji', 'Ab asli kaam. Kidhar Driver app pe duty laga (J), teen sawaari utha.'], ['mamaji', 'Aaraam se chalana. Rating achhi hogi toh kamaai achhi hogi.']] },
        { task: 'rides', count: 3, label: 'Complete 3 Kidhar rides with an average of 3.5★ or more' },
        { reward: 1000, line: 'Teen sawaari, achhi rating! Mamaji proud hai.' },
      ],
    },
    {
      id: 'holi', title: 'Holi Hai!', strand: 'story', after: 'firstrides', at: P.maidan, giver: 'mamaji',
      steps: [
        { cut: [['mamaji', 'Aaj Holi hai, bhanje! Maidan pe sab rang khel rahe hain.'], ['mamaji', 'Taxi chhod (F), pichkari utha (2) aur das logon ko rang laga. Bura na mano, Holi hai!']] },
        { goto: P.maidan, label: 'Go to Azad Maidan' },
        { task: 'colour', count: 10, limit: 150, label: 'Colour 10 people with the pichkari', fail: 'Holi khatam ho gayi! Try again.' },
        { reward: 500, line: 'Wah! Poora maidan rangeen kar diya!' },
      ],
    },
    {
      id: 'ghar', title: 'Ghar Ka Rasta', strand: 'story', after: 'holi', at: P.start, giver: 'mamaji',
      steps: [
        { cut: [['mamaji', 'Bhanje, ab tu Mumbaikar ho gaya. Powai mein ek flat dekha hai tere liye — Lake Breeze, barahvi manzil.'], ['mamaji', 'Lamba rasta hai: Dadar, Sion, phir Powai. GPS laga, aaraam se ja. Chaabi watchman ke paas hai.'], ['you', 'Apna ghar… Mumbai mein! Mamaji, aap great ho.']] },
        { goto: P.home, label: 'Drive home to Lake Breeze, Powai (the phone\'s Ghar app also has "GPS route home")', on: 'vehicle', radius: 60 },
        { reward: 3000, line: 'Ghar aa gaya! Lake ka view toh dekho.' },
      ],
    },

    // ------------------------------------------------------------------ side missions
    {
      id: 'meter', title: 'Mere Paas Meter Hai', strand: 'side', after: 'welcome', at: P.terminusRoad, giver: 'pandey',
      cast: { pandey: { name: 'Pandey ji', kind: 'office' }, rival: { name: 'Kidhar XL wala', kind: 'casual' } },
      steps: [
        { cut: [['rival', 'Sir, meri gaadi mein AC hai, app hai, surge hai, paanch-star rating hai. Is khatara ke paas kya hai?'], ['you', 'Mere paas… meter hai.'], ['pandey', 'Bas! Meter se chalo. Nariman Point, das minute mein meeting hai. Aaraam se, par jaldi!']] },
        { pickup: 'pandey', at: P.terminusRoad, line: 'Chalo bhai. Brake dheere lagana, kal hi dentist ke paas gaya tha.' },
        { cargo: { name: 'Pandey ji\'s patience', min: 0.45, icon: '🙂' } },
        { goto: P.nariman, label: 'Drive Pandey ji to Nariman Point — smoothly', on: 'taxi', limit: 210, fail: 'The meeting started without Pandey ji.' },
        { cargo: null },
        { dropoff: 'pandey', line: 'Time pe, aur ek bhi jhatka nahi. Meter zindabad!' },
        { reward: 800, line: 'App hai, surge hai… par meter meter hota hai.' },
      ],
    },
    {
      id: 'dabba', title: 'Galat Dabba', strand: 'side', after: 'welcome', hours: [9, 14], at: P.churchgate, giver: 'ganpat',
      cast: { ganpat: { name: 'Ganpat dabbawala', kind: 'worker', cap: true } },
      steps: [
        { cut: [['ganpat', 'Bhau! Sau saal mein pehli baar galti ho gayi. Do dabbe badal gaye!'], ['ganpat', 'Ek mein Sharma ji ka karela hai, doosre mein kisi ki chitthi. Lunch se pehle dono sahi jagah pahuncha do!'], ['you', 'Dabba delivery? Chalo, yeh bhi kar lete hain.']] },
        { cargo: { name: 'Two tiffins', min: 0.4, icon: '🍱' } },
        { visit: [[...P.nariman, 'Sharma ji\'s office, Nariman Point'], [...P.fortOffice, 'Fort office, Ballard side']], label: 'Deliver both tiffins before lunch', on: 'vehicle', limit: 260, fail: 'Lunch time is over. Sharma ji ate a vada pav in a very bad mood.' },
        { cargo: null },
        { reward: 600, line: 'Dono dabbe sahi jagah! Ganpat ki izzat bach gayi.', also: (w) => w.state.eat?.(1) },
      ],
    },
    {
      id: 'reel', title: 'Picture Abhi Baaki Hai', strand: 'side', after: 'welcome', at: P.fountain, giver: 'sawant',
      cast: { sawant: { name: 'Sawant kaka', kind: 'office' } },
      steps: [
        { cut: [['sawant', 'Beta! Mahaan Mandir Talkies mein interval ho gaya hai, aur doosra reel yahan reh gaya!'], ['sawant', 'Tees saal se woh picture roz chalti hai. Aaj pehli baar adhuri reh jayegi. Bhaga, par reel ko jhatka mat dena!'], ['you', 'Fikar not, kaka. Picture abhi baaki hai.']] },
        { cargo: { name: 'Film reel', min: 0.35, icon: '🎞️' } },
        { goto: P.talkies, label: 'Rush the reel to Mahaan Mandir Talkies before the interval ends', on: 'vehicle', limit: 300, radius: 30, fail: 'The audience went home. The projector is very sad.' },
        { cargo: null },
        { reward: 900, line: 'Reel aa gaya! Picture shuru!' },
      ],
    },
    {
      id: 'penguin', title: 'Penguin Ko Pakadna Naamumkin Hai', strand: 'side', after: 'welcome', at: P.zoo, giver: 'keeper',
      cast: { keeper: { name: 'Zoo keeper Tai', kind: 'worker', cap: true } },
      steps: [
        { cut: [['keeper', 'Arre deva! Humara penguin Chintu AC room se nikal ke bhaag gaya!'], ['keeper', 'Garmi mein zyada der nahi chalega. Gaadi se utro, paidal pakdo. Thak jaata hai jaldi, par bahut chalaak hai.'], ['you', 'Penguin ko pakadna mushkil hi nahi… chalo dekhte hain.']] },
        { catch: 'penguin', at: P.zoo, label: 'Catch Chintu the penguin on foot (Shift to run; he tires in bursts)' },
        { reward: 1200, line: 'Chintu wapas AC mein! Yeh lo, penguin ke saath selfie free.' },
      ],
    },
    {
      id: 'chai', title: 'Hawaldar Khush Hua', strand: 'side', after: 'welcome', hours: [8, 22], at: P.kalaGhoda, giver: 'shinde',
      cast: { shinde: { name: 'Head constable Shinde', kind: 'police', cap: true } },
      steps: [
        { cut: [['shinde', 'Aye taxi! Idhar aa. Darr mat, challan nahi kaat raha.'], ['shinde', 'Mere teen jawan subah se dhoop mein khade hain. Cutting chai pahuncha de, garam garam. Ek boond bhi giri toh…'], ['you', 'Samajh gaya saheb. Chai garam, hawaldar naram.']] },
        { cargo: { name: 'Tray of cutting chai', min: 0.5, icon: '☕' } },
        { visit: [[...P.fountain, 'Constable at Flora Fountain'], [...P.terminusRoad, 'Constable at the Terminus junction'], [...P.churchgate, 'Constable at Churchgate']], label: 'Deliver chai to the three constables before it goes cold', on: 'vehicle', limit: 300, fail: 'The chai went cold. So did the hawaldar.' },
        { cargo: null },
        { reward: 400, line: 'Hawaldar khush hua! Saare challan maaf.', also: (w) => { w.police.stars = 0; w.police.fines = 0; } },
      ],
    },
    {
      id: 'dhoom', title: 'Dhoom-Dhaam', strand: 'side', after: 'welcome', hours: [20, 5], at: P.marineSouth, giver: 'rocky',
      cast: { rocky: { name: 'Rocky', kind: 'casual' } },
      steps: [
        { cut: [['rocky', 'Raat ko Marine Drive khaali hota hai, boss. Bike la, Chowpatty tak race. Do minute mein.'], ['rocky', 'Bike nahi hai? Toh kisi se "udhaar" le le. Par signal todega toh hawaldar tera, main nahi.'], ['you', 'Dhoom toh machegi. Dhaam bhi.']] },
        { race: [P.marineMid, P.marineNorth, P.chowpatty], label: 'On a two-wheeler: race up Marine Drive to Chowpatty', on: 'two', limit: 150, fail: 'Too slow. Rocky is already eating bhel at Chowpatty.' },
        { reward: 1500, line: 'Kya chalaya! Queen\'s Necklace ka raja.' },
      ],
    },
    {
      id: 'shooting', title: 'Rangeela Re-Take', strand: 'side', after: 'welcome', hours: [7, 19], at: P.asiatic, giver: 'director',
      cast: { director: { name: 'Director saab', kind: 'casual', cap: true } },
      steps: [
        { cut: [['director', 'Cut! Cut! Hero ki gaadi kahan hai? Mujhe ek Swyft chahiye, abhi ke abhi!'], ['director', 'Tum! Taxi wale! Kahin se ek Maroti Swyft le aao. Ek kharonch bhi nahi honi chahiye, close-up hai.'], ['you', 'Sir, "le aao" ka matlab…?'], ['director', 'Matlab mat poocho. Art ke liye sab jaayaz hai. Action!']] },
        { goto: P.asiatic, label: 'Bring a Maroti Swyft to the film set in good condition (F on foot next to one takes it)', on: 'swift', radius: 26, limit: 420, minCondition: 0.8, fail: 'Pack-up! The director shot the scene with a bullock cart.' },
        { reward: 2000, line: 'Perfect! Tum toh production ke aadmi nikle.' },
      ],
    },
    {
      id: 'cake', title: 'Romance Ka Badshah', strand: 'side', after: 'welcome', at: P.hillRoad, giver: 'aunty',
      cast: { aunty: { name: 'D\'Souza aunty', kind: 'sari' } },
      steps: [
        { cut: [['aunty', 'Son, today is Armaan Raizada\'s birthday. My bakery made the cake. Fifty kilos, five tiers!'], ['aunty', 'The delivery boy ran away when he saw the crowd at Khwaab. You take it. Slowly! Cream is not cement.'], ['you', 'Aunty, tension mat lo. Cake aur main, dono seedhe pahunchenge.']] },
        { cargo: { name: 'Five-tier birthday cake', min: 0.55, icon: '🎂' } },
        { goto: villa, label: 'Deliver the cake to villa Khwaab on the Bandra seafront — gently', on: 'vehicle', limit: 300, radius: 24, fail: 'The cake is now a pancake.' },
        { cargo: null },
        { call: (w) => w.stars?.callOut() },
        { reward: 1200, line: 'Cake pahunch gaya! Aur dekho, Armaan khud bahar aa rahe hain.' },
      ],
    },
    {
      id: 'diwali', title: 'Phatakon Ki Raat', strand: 'side', after: 'welcome', hours: [18.5, 22], at: P.marine, giver: 'uncle',
      cast: { uncle: { name: 'Mehta uncle', kind: 'office' } },
      steps: [
        { cut: [['uncle', 'Beta, bachchon ke liye phatake laya tha, par ghutne mein dard hai. Tum jala do na!'], ['uncle', 'Teen anar, do chakri, teen sky shot. Aur das baje se pehle — uske baad hawaldar aa jaata hai.'], ['you', 'Uncle, aap bas dekhte jao.']] },
        { task: 'crackers', need: { anar: 3, chakri: 2, rocket: 3 }, label: 'On foot: light 3 anars, 2 chakris and 3 sky shots (X lights, Z changes type)', limit: 240, fail: 'The children fell asleep waiting.' },
        { reward: 500, line: 'Wah! Poori building taali baja rahi hai. Happy Diwali, beta!' },
      ],
    },
  ];
  return { missions, places: P };
}
