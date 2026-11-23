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
//   { pickup: id, at, line, on } / { dropoff: id, line }  a passenger (for the taxi unless `on` names a vehicle type)
//   { waitHour: [from, to], label }
//   { pay: rupees, label, what, line }                a fee; waits until the player has the money
//   { cargo: { name, min, icon } } / { cargo: null }  something fragile on board until cleared
//   { visit: [[x, z, label], ...], label, on, limit } several stops in any order
//   { race: [[x, z], ...], label, on, limit }         checkpoints in order, against the clock
//   { catch: 'penguin', at, label }                   chase a runaway on foot
//   { task: 'rides' | 'colour' | 'crackers', ... }    counters
//   { lend: type, at }                                a vehicle parked by the kerb for this mission (auto, tanker, …)
//   { call: (world) => void }                         a hook into another system
//   { reward: rupees, line, also: (world) => void }

const ll = (index, lat, lon) => [(lon - index.origin.lon) * index.metresPerDegree.lon, -(lat - index.origin.lat) * index.metresPerDegree.lat];

export function buildMissions(index, home) {
  const L = (id) => index.landmarks?.find((l) => l.id === id);
  const term = L('terminus'), gw = L('gateway');
  const P = {
    // The first marker sits a short drive ahead of where the taxi starts.
    // 40 m up the road from the spawn: in view at the start, but not under the taxi before you have looked around.
    start: index.spawn ? [index.spawn.x + Math.sin(index.spawn.heading || 0) * 40, index.spawn.z + Math.cos(index.spawn.heading || 0) * 40] : [0, 0],
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
    // Suburbs and mid-town (missions with borrowed vehicles)
    bandraStn: ll(index, 19.0544, 72.8400),
    linking: ll(index, 19.0640, 72.8345),
    bandstand: ll(index, 19.0447, 72.8198),
    irla: ll(index, 19.1075, 72.8375),
    juhuCircle: ll(index, 19.1070, 72.8300),
    juhuTara: ll(index, 19.0980, 72.8265),
    santacruz: ll(index, 19.0830, 72.8370),
    shivajiPark: ll(index, 19.0267, 72.8384),
    parel: ll(index, 19.0025, 72.8420),
    fiveGardens: ll(index, 19.0205, 72.8535),
    kingsCircle: ll(index, 19.0275, 72.8555),
    wadala: ll(index, 19.0170, 72.8580),
    dadarTT: ll(index, 19.0183, 72.8478),
    hinduColony: ll(index, 19.0215, 72.8490),
    rto: ll(index, 18.9690, 72.8135),          // the transport office, Tardeo
    colabaDepot: ll(index, 18.9105, 72.8190),
    regal: ll(index, 18.9255, 72.8320),
    hanging: ll(index, 18.9565, 72.8052),
    thakurdwar: ll(index, 18.9535, 72.8215),
    khotachiwadi: ll(index, 18.9548, 72.8190),
    charni: ll(index, 18.9515, 72.8195),
    operaHouse: ll(index, 18.9558, 72.8155),
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

    {
      id: 'permit', title: 'Permit Raj', strand: 'story', after: 'ghar', hours: [9, 17], at: P.start, giver: 'mamaji',
      cast: { babu: { name: 'Babu at counter 7', kind: 'office' } },
      steps: [
        { cut: [['mamaji', 'Bhanje, ek kaam reh gaya. Taxi ka permit is mahine khatam ho raha hai.'], ['mamaji', 'Tardeo ke RTO ja. Fitness test hoga — gaadi chamakti honi chahiye, nabbe percent se upar. Aur fees teen hazaar.'], ['you', 'Line kitni lambi hogi, Mamaji?'], ['mamaji', 'Beta, yeh Mumbai hai. Line hi toh zindagi hai.']] },
        { goto: P.rto, label: 'Drive your taxi to the RTO in Tardeo — in good condition (repair at a petrol pump, E)', on: 'taxi', minCondition: 0.9, radius: 30 },
        { cut: [['babu', 'Form 4A? Yeh toh Form 4B hai. Khidki number saat pe jao.'], ['you', 'Yeh khidki number saat hi hai…'], ['babu', 'Haan toh lunch ke baad aana. Achha theek hai, theek hai. Gaadi dikhao. Hmm. Chamak rahi hai. Fees?']] },
        { pay: 3000, label: 'Pay the permit fee at the RTO', what: 'Taxi permit renewal', line: 'Stamp! Agle paanch saal ke liye permit pakka.' },
        { reward: 4000, line: 'Mamaji: "Shabaash! Ab yeh taxi kaagaz pe bhi teri hai." (He sent the fee back on PayKaro, and a little more.)' },
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
    // ------------------------------------------------------------------ side missions with borrowed vehicles
    {
      id: 'auto', title: 'Auto No. 1', strand: 'side', after: 'welcome', at: P.bandraStn, giver: 'salim',
      cast: { salim: { name: 'Salim bhai', kind: 'khaki' }, neha: { name: 'Neha', kind: 'casual' }, batli: { name: 'Batliwala uncle', kind: 'office' } },
      steps: [
        { cut: [['salim', 'Arre bhai, ghutna gaya kaam se. Aaj meri auto tu chala. Do sawaari, bas.'], ['you', 'Auto? Main toh taxi wala hoon.'], ['salim', 'Taxi mein chaar pahiye, ismein teen. Ek pahiya kam, tension bhi kam.'], ['salim', 'Aur sun: meter se chalana. Bandra ka naam kharab mat karna.']] },
        { lend: 'auto', at: P.bandraStn },
        { goto: P.hillRoad, label: 'Take Salim bhai\'s auto (F next to it) to Hill Road', on: 'auto' },
        { pickup: 'neha', on: 'auto', at: P.hillRoad, line: 'Bhaiya, Linking Road. Meter se chaloge? Sach mein?! Aaj toh lottery lag gayi.' },
        { goto: P.linking, label: 'Drive Neha to Linking Road', on: 'auto', limit: 220, fail: 'Neha got off and took the bus.' },
        { dropoff: 'neha', line: 'Meter se, bina jhik-jhik. Tumhe toh award milna chahiye!' },
        { pickup: 'batli', on: 'auto', at: P.linking, line: 'Bandstand chalo, dikra. Town mat bolna — mujhe pata hai auto town nahi jaati.' },
        { goto: P.bandstand, label: 'Drive Batliwala uncle to Bandstand', on: 'auto', limit: 260, fail: 'Uncle walked. He is not happy about it.' },
        { dropoff: 'batli', line: 'Samundar ki hawa aur teen pahiye — yahi toh Bandra hai.' },
        { reward: 1100, line: 'Salim bhai ki auto, Salim bhai ki izzat — dono salaamat!' },
      ],
    },
    {
      id: 'tanker', title: 'Jal Bin Society', strand: 'side', after: 'welcome', at: P.irla, giver: 'bablu',
      cast: { bablu: { name: 'Bablu tanker-wala', kind: 'worker' } },
      steps: [
        { cut: [['bablu', 'Bhai, teen society mein subah se paani nahi aaya. Secretary log phone kar-kar ke pagal ho gaye.'], ['bablu', 'Mera haath moch gaya hai. Tanker tu le ja. Dheere chalana — paani chhalka toh aadha raste mein reh jayega.'], ['you', 'Paani pahunchega, Bablu. Poora.']] },
        { lend: 'tanker', at: P.irla },
        { cargo: { name: 'Water in the tank', min: 0.4, icon: '💧' } },
        { visit: [[...P.juhuCircle, 'Sea Breeze Society, Juhu'], [...P.juhuTara, 'Sagar Darshan, Juhu Tara Road'], [...P.santacruz, 'Gulmohar Society, Santacruz']], label: 'In the water tanker: fill the tanks of all three societies', on: 'tanker', limit: 520, fail: 'The societies ordered another tanker. Bablu lost three customers.' },
        { cargo: null },
        { reward: 1500, line: 'Teeno society mein paani! Aaj Bablu ka naam roshan ho gaya.' },
      ],
    },
    {
      id: 'ambulance', title: 'Dadi Bhai M.B.B.S.', strand: 'side', after: 'welcome', at: P.shivajiPark, giver: 'joshi',
      cast: { joshi: { name: 'Dr. Joshi', kind: 'office' }, dadi: { name: 'Dadi', kind: 'sari' } },
      steps: [
        { cut: [['joshi', 'Suno! Dadi ka pair mud gaya morning walk mein. X-ray chahiye, Parel ke bade hospital mein.'], ['joshi', 'Ambulance khadi hai par driver chai peene gaya hai. Tum chalao. Aaraam se!'], ['dadi', 'Beta, tez mat chalana. Mujhe hospital pahunchna hai, akhbaar mein nahi.']] },
        { lend: 'ambulance', at: P.shivajiPark },
        { pickup: 'dadi', on: 'ambulance', at: P.shivajiPark, line: 'Chalo beta. Aur woh siren mat bajana, sar dard hota hai.' },
        { cargo: { name: 'Dadi\'s comfort', min: 0.5, icon: '👵' } },
        { goto: P.parel, label: 'Drive Dadi to the big hospital in Parel — gently', on: 'ambulance', limit: 300, radius: 30, fail: 'Dadi got out and took a taxi. A different taxi.' },
        { cargo: null },
        { dropoff: 'dadi', line: 'Shabaash! Ek bhi jhatka nahi. Yeh lo, shagun ke gyarah rupaye… aur thoda upar se.' },
        { reward: 1000, line: 'Dadi theek hai. Sirf moch thi — aur thodi si naraazgi.' },
      ],
    },
    {
      id: 'school', title: 'Taare Bus Stop Par', strand: 'side', after: 'welcome', hours: [6, 10], at: P.fiveGardens, giver: 'principal',
      cast: { principal: { name: 'Principal D\'Mello', kind: 'sari' } },
      steps: [
        { cut: [['principal', 'Young man! Our bus driver has overslept and forty children are standing at three stops.'], ['principal', 'The bell rings soon. Collect them all and bring them to school. And no rash driving — their tiffins are open already.'], ['you', 'Yes ma\'am. Sorry ma\'am. Going, ma\'am.']] },
        { lend: 'school', at: P.fiveGardens },
        { cargo: { name: 'Tiffins and water bottles', min: 0.4, icon: '🎒' } },
        { visit: [[...P.kingsCircle, 'Bus stop: King\'s Circle'], [...P.wadala, 'Bus stop: Wadala'], [...P.dadarTT, 'Bus stop: Dadar T.T.']], label: 'In the school bus: pick up the children at all three stops', on: 'school', limit: 420, fail: 'The children walked to school. They were delighted to be late.' },
        { goto: P.hinduColony, label: 'Get the children to school in Hindu Colony before the bell', on: 'school', limit: 200, radius: 30, fail: 'The bell rang. Forty late marks, and one for you.' },
        { cargo: null },
        { reward: 1300, line: 'Before the bell! Full attendance, and nobody lost a tiffin.' },
      ],
    },
    {
      id: 'milk', title: 'Doodhwala Express', strand: 'side', after: 'welcome', hours: [5, 9], at: P.thakurdwar, giver: 'yadav',
      cast: { yadav: { name: 'Yadav doodhwala', kind: 'worker' } },
      steps: [
        { cut: [['yadav', 'Bhaiya, meri bhains ne aaj double doodh diya, aur main akela! Teen building baaki hain.'], ['yadav', 'Meri cycle le jao. Chai ke time se pehle doodh pahunchna chahiye, warna poori gali bina chai ke uthegi.'], ['you', 'Bina chai ki Mumbai? Yeh nahi ho sakta.']] },
        { lend: 'cycle', at: P.thakurdwar },
        { cargo: { name: 'Milk cans', min: 0.45, icon: '🥛' } },
        { visit: [[...P.khotachiwadi, 'Khotachiwadi'], [...P.charni, 'The chawl by Charni Road'], [...P.operaHouse, 'Opera House building']], label: 'On the bicycle: deliver milk to all three buildings before chai time', on: 'cycle', limit: 330, fail: 'The lane woke up without chai. Nobody is speaking to Yadav.' },
        { cargo: null },
        { reward: 500, line: 'Doodh time pe! Yeh lo, ek glass taaza doodh.', also: (w) => w.state.eat?.(1) },
      ],
    },
    {
      id: 'bus', title: 'BEST Of Luck', strand: 'side', after: 'welcome', hours: [7, 21], at: P.colabaDepot, giver: 'conductor',
      cast: { conductor: { name: 'Conductor Kamble', kind: 'khaki', cap: true } },
      steps: [
        { cut: [['conductor', 'Arre driver saab nahi aaye aaj! Bus bhari hai, log chilla rahe hain.'], ['conductor', 'Tum taxi chalate ho na? Bas thodi lambi taxi samjho. Chaar stop, phir Crawford Market. Aaraam se — log khade hain!'], ['you', 'Ticket, ticket! …Yeh aap bolo, main chalata hoon.']] },
        { lend: 'bus', at: P.colabaDepot },
        { cargo: { name: 'Standing passengers', min: 0.4, icon: '🚌' } },
        { visit: [[...P.regal, 'Bus stop: Regal Circle'], [...P.fountain, 'Bus stop: Flora Fountain'], [...P.terminusRoad, 'Bus stop: Chai Terminus']], label: 'In the BEST bus: stop at all three bus stops', on: 'bus', limit: 420, fail: 'The passengers got off and took taxis. Kamble is writing a report.' },
        { goto: P.crawford, label: 'Last stop: Crawford Market', on: 'bus', limit: 200, radius: 30, fail: 'Too late: the 138 behind you overtook. Twice.' },
        { cargo: null },
        { reward: 1400, line: 'Last stop! Sab utro. Driver saab, kal bhi aa jao!' },
      ],
    },
    {
      id: 'darshan', title: 'Bombay Darshan', strand: 'side', after: 'welcome', hours: [15, 19.5], at: P.gateway, giver: 'guide',
      cast: { guide: { name: 'Guide Pinto', kind: 'casual', cap: true } },
      steps: [
        { cut: [['guide', 'Boss! Forty tourists, one open-top double-decker, zero drivers. You are my hero today.'], ['guide', 'Gateway, then Marine Drive, Chowpatty and up to Hanging Gardens for the sunset. Slowly — they are standing upstairs with cameras.'], ['you', 'Ladies and gentlemen, on your left: traffic. On your right: more traffic.']] },
        { lend: 'decker', at: P.gateway },
        { cargo: { name: 'Tourists upstairs', min: 0.45, icon: '📸' } },
        { visit: [[...P.marine, 'Photo stop: Marine Drive'], [...P.chowpatty, 'Photo stop: Girgaum Chowpatty']], label: 'In the double-decker: make both photo stops', on: 'decker', limit: 480, fail: 'The tourists gave the tour one star. "Too much Bombay, not enough darshan."' },
        { goto: P.hanging, label: 'Take the tour up to Hanging Gardens for the sunset', on: 'decker', limit: 300, radius: 34, fail: 'The sun set without you.' },
        { cargo: null },
        { reward: 1600, line: 'What a sunset! Forty five-star reviews, boss.' },
      ],
    },
  ];
  return { missions, places: P };
}
