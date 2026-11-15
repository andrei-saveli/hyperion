# ByteMe: prezentarea arhitecturii (textul oral)

Slide-urile sunt în engleză (`ByteMe_System_Design.pptx`); acesta este textul de spus, în română. Același text este și în notele vorbitorului din fiecare slide.

- **Partea 1, prezentare generală** (slide-urile 1–3, aprox. 2 minute): pe înțelesul tuturor.
- **Partea 2, implementare tehnică** (slide-urile 4–11, aprox. 5–6 minute).

## Partea 1: prezentare generală

### Slide 1: ByteMe (titlu)

Bună ziua! Suntem echipa Byte Me Analytics, iar proiectul nostru pentru NASA Space Apps se numește ByteMe, un „detectiv al tendințelor” de pe Pământ.

Pe scurt: NASA măsoară planeta de peste 40 de ani, din satelit și cu modele climatice. Datele sunt publice, dar greu de folosit: mii de variabile, fișiere uriașe, unelte făcute pentru cercetători. Noi am construit un site unde oricine, de la un elev de liceu la un adult curios, poate afla dacă ceva se schimbă cu adevărat într-un loc anume.

În prezentarea de azi vă arătăm mai întâi ce face sistemul, pe înțelesul tuturor, apoi cum este construit pe dinăuntru.

### Slide 2: One question in, four answers out

Totul pornește de la o întrebare. Utilizatorul scrie un loc sau o întrebare, sau pur și simplu dă click pe hartă.

Sistemul face cinci pași: înțelege întrebarea, găsește locul (poate fi un oraș, o țară întreagă sau chiar un râu), aduce datele lunare de la NASA, testează dacă există o tendință și apoi explică rezultatul în cuvinte simple.

Exemplu: „Se încălzește România?” Răspunsul: „Da. Temperatura aerului în România crește cu 0,57 grade pe deceniu, din 1981.” Și nu doar spunem asta: arătăm graficul, linia de tendință și cât de siguri suntem.

Răspundem la patru întrebări: ce se schimbă, unde, cât de mult și cât de siguri suntem. Un lucru nu-l facem niciodată: nu spunem DE CE. O linie pe un grafic nu poate dovedi o cauză, iar noi vrem să fim cinstiți cu utilizatorii.

### Slide 3: System at a glance

Iată imaginea de ansamblu, în trei coloane.

În stânga: ce pregătim o singură dată, pe calculatorul nostru. Unele date NASA, de exemplu de la sateliții GPM, MODIS sau OMI, cer un cont special. Le descărcăm noi, le prelucrăm și le salvăm ca fișiere gata de folosit. Așa, vizitatorul nu are nevoie de niciun cont.

În mijloc: site-ul propriu-zis. E un site „static”, adică doar fișiere, fără un server al nostru. Toată munca, de la căutare la calculele statistice, se face direct în browserul vizitatorului. Asta înseamnă găzduire gratuită și nimic de instalat.

În dreapta: serviciile pe care le întrebăm în timp real: NASA POWER pentru date din orice punct de pe glob, servicii de hărți pentru numele locurilor și pentru fundalul hărții.

Și pentru că un demo live nu are voie să pice: dacă un serviciu extern nu răspunde, site-ul are rezerve: o hartă de bază inclusă, căutare fără modelul de limbaj și un mesaj clar în loc de o pagină goală.

[TRANZIȚIE] Acum, să intrăm în detalii tehnice.

## Partea 2: implementare tehnică

### Slide 4: Inside the browser: five layers

În browser, codul e împărțit în cinci straturi, fiecare cu fișierele lui.

Interfața: index.html pentru structură, style.css pentru aspect și varianta de telefon, iar app.js leagă toate componentele.

Căutarea: reguli pe cuvinte-cheie definite în variables.json, pentru 26 de măsurători, plus un model de limbaj mic, care rulează local, și căutarea locurilor.

Datele: clientul pentru NASA POWER, nasa.js, care citește fișierele noastre cu date satelitare pe pătrate de 1 grad, și area.js, care face mediile pe țări și râuri.

Analiza, inima proiectului: stats.js pentru tendință și semnificație, plus module pentru perioade de timp, pentru posibilii factori care influențează o tendință și pentru locuri asemănătoare.

Vizualizarea: MapLibre pentru hartă, Plotly pentru grafice.

### Slide 5: Search: from a sentence to an investigation

Căutarea transformă o propoziție într-o investigație. Exemplu: „Se încălzește România din 2005?”

Întrebarea e descompusă pe trei piste, în paralel.

Prima: ce măsurătoare. Avem reguli pe cuvinte: lucrăm cu rădăcina cuvintelor, deci „warmer” și „warming” înseamnă același lucru; o expresie întreagă valorează 6 puncte, un cuvânt-cheie 3, unul slab 2; expresia cea mai lungă câștigă. Lângă reguli avem un model de limbaj, all-MiniLM, care rulează în browser și compară sensul întrebării cu descrierile măsurătorilor. Îl folosim doar când e suficient de sigur: scor de cel puțin 0,42 și un avans de cel puțin 0,03 față de următorul subiect. Apoi combinăm clasamentele.

A doua: locul. Coordonatele merg direct, regiunile cunoscute, ca Sahelul, au o casetă predefinită, iar restul numelor trec prin serviciile de geocodare Photon, Open-Meteo și Nominatim.

A treia: perioada și anotimpul, de exemplu „din 2005” sau „vara”.

Rezultatul: un loc, o măsurătoare și o perioadă. Întrebările de tip „de ce” primesc o notă că arătăm ce s-a schimbat, nu de ce, iar pentru lucruri pe care nu le putem măsura spunem clar asta și propunem cea mai apropiată măsurătoare.

### Slide 6: The trend engine

Acesta este motorul statistic, în șase pași.

Unu: seria lunară; lunile lipsă sunt sărite, nu tratate ca zero. Doi: eliminăm anotimpurile, adică cele 12 medii lunare, estimate împreună cu linia de tendință. Trei: o dreaptă prin metoda celor mai mici pătrate; panta ne dă schimbarea pe deceniu. Patru: corecția pentru „memorie”: o lună caldă e urmată de obicei tot de una caldă, deci 500 de luni nu înseamnă 500 de informații independente. Calculăm autocorelația de ordinul 1 și numărul efectiv de luni, după Santer, 2000. Cinci: două teste: testul t cu interval de încredere de 95% și testul sezonier Mann-Kendall cu panta Sen, ca a doua opinie. Șase: verdictul.

De ce contează corecția? Pe date aleatoare cu memorie, un test naiv strigă „semnificativ” în 44% din cazuri. Al nostru, în doar 6%, aproape de 5%, cât ar trebui.

Și încă ceva: același cod există în Python, pentru hărțile pregătite dinainte, și în JavaScript, în browser. Le-am comparat pe 105 serii reale, cu 2.051 de verificări: zero diferențe.

Verdictele: semnificativ sub 0,05, posibil sub 0,10, nicio tendință clară încă (niciodată „nicio schimbare”) și date insuficiente, sub 10 ani.

### Slide 7: From one point to a whole country

Cum trecem de la un punct la o țară întreagă?

Unu: conturul. Îl luăm din OpenStreetMap; pentru regiuni celebre folosim o casetă, iar pentru râuri punem puncte de-a lungul cursului.

Doi: eșantionăm: până la 16 puncte NASA POWER în interior, plus fiecare pătrat de 1 grad din datele satelitare.

Trei: ponderăm fiecare pătrat cu cosinusul latitudinii, pentru că pătratele de lângă poli acoperă mai puțină suprafață. Pe imagine, pătratele mai deschise contează mai puțin.

Patru: o lună contează doar dacă cel puțin jumătate din pătrate au date.

Cinci: obținem o singură serie medie și o trecem prin exact același motor statistic.

În plus, unde o măsurătoare există din două surse, de exemplu modelul MERRA-2 și satelitul AIRS pentru temperatură, le testăm pe amândouă. Dacă sunt de acord, afișăm „confirmat de…”.

### Slide 8: Going deeper: Investigate

Pentru cine vrea să sape mai adânc, avem secțiunea Investighează, cu două unelte.

Prima: descompunerea tendinței. Elevul alege posibili factori, iar sistemul calculează cât din tendință „explică” statistic fiecare. Exemplu real: în Svalbard, stratul de zăpadă scade cu 4,8 cm pe deceniu. Temperatura aerului are o legătură reală, dar explică doar în jur de 9%; restul rămâne neexplicat. Tehnic: regresia se face pe fluctuațiile de la o lună la alta, nu pe tendințe, ca două serii care doar cresc împreună să nu pară legate. Intervalele vin dintr-un bootstrap pe blocuri, cu 400 de repetări, iar un „test de alibi” decalează factorul cu câțiva ani: o legătură reală trebuie să dispară.

A doua: locuri care se schimbă la fel. Fiecare pătrat de 5 grade are o „amprentă” din cele 18 tendințe, comparate cu media planetei. Găsim cele mai asemănătoare cinci locuri cu similaritatea cosinus, la cel puțin 1.500 km distanță. Din nou, arătăm asemănări, nu cauze.

### Slide 9: How we know it works

Cum știm că funcționează? Prin teste automate.

34 de teste în Python pe date construite cu răspuns cunoscut. 2.051 de verificări că browserul calculează exact ca Python. La căutare, pe 36 de întrebări ținute deoparte și nefolosite la reglaj, găsim locul și măsurătoarea corecte din prima în 33 de cazuri. Toate cele 8 întrebări fără legătură cu subiectul au fost refuzate corect.

Avem câte un test pentru fiecare modul: statistică, fișiere satelitare, medii pe suprafețe, perioade, descompunere, căutare, căutare după sens și locuri asemănătoare.

Și, cinstit: întrebările de test au fost scrise de echipă. Următorul pas este testarea cu elevi reali.

### Slide 10: Design choices and their price

Fiecare decizie de design are un preț și vrem să-l spunem deschis.

Site static, fără server: găzduire gratuită și fără cont, dar depindem de servicii externe live, de aceea avem rezerve.

Datele satelitare pregătite o dată: vizitatorul nu are nevoie de cont NASA, dar înseamnă circa 200 MB de fișiere, iar reconstruirea cere un token.

Modelul de limbaj în browser: privat, fără cheie API, fără cost per întrebare, dar circa 23 MB la prima încărcare; de aceea cazurile clare le decid tot regulile pe cuvinte.

Tendințe liniare după eliminarea anotimpurilor: exact ce cere provocarea și ușor de explicat, dar ratăm schimbările curbe, și spunem asta utilizatorului.

Și nu afirmăm niciodată cauze: chiar și descompunerea spune „explică statistic”, nu „cauzează”.

### Slide 11: Încheiere

Pe scurt: ByteMe răspunde la ce s-a schimbat, unde, cât de mult și cât de siguri suntem. Niciodată de ce.

Pașii următori: testare cu elevi reali, publicarea pe domeniul oferit de Space Apps și adăugarea mai multor seturi de date NASA.

Vă mulțumim! Suntem gata pentru întrebări și, dacă vreți, vă arătăm site-ul live.

