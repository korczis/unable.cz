+++
title = "Able.cz — Due Diligence z veřejných zdrojů"
description = "Due diligence Able.cz s.r.o. (IČO 24278815) z veřejných zdrojů: ověřená fakta z rejstříku, tvrzení firmy a rozšířená síť souvisejících osob a firem."
template = "dossier.html"

date = 2026-07-17
updated = 2026-07-19

[extra]
seo_type = "Report"
og_type = "article"
og_image_alt = "Able.cz — Due Diligence z veřejných zdrojů"

[extra.evidence]
cutoff = 2026-07-18
reviewed_at = 2026-07-18
review_interval_days = 90
confidence = "moderate"
freshness_class = "periodically_reviewed"
sources_consulted = 22
+++

## Souhrn

Toto je **due diligence review z veřejných zdrojů** společnosti **Able.cz s.r.o.**
(IČO 24278815), softwarové firmy z Brna. Odděluje to, co nezávisle ověřuje
veřejný rejstřík, od toho, co firma tvrdí sama o sobě. **Není** to plná
transakční due diligence: nebyla k dispozici datová místnost, manažerské
pohovory, smlouvy, bankovní záznamy, daňové doklady ani přístup ke zdrojovému
kódu, a veřejná evidence je nemůže nahradit.

Základní identita firmy je **ověřená** přímo proti úředním záznamům rejstříku
(ARES/VR), stažených, uložených a otisknutých SHA-256 — každé tvrzení níže se
dá rozkliknout až na přesnou pasáž zachovaného dokumentu. Průchod z 18. 7. 2026
nahradil dřívější rejstříková zrcadla **primárními úředními artefakty** pro
všech 19 prověřovaných entit a přinesl podstatné korekce:

- Společnost prvních čtyř roky podnikala pod jménem **BIT CONSULTING s.r.o.**
  a byla původně zapsána v Praze — přejmenování na Able.cz proběhlo až v
  listopadu 2016; žádné zrcadlo tento fakt nezachytilo.
- Největším společníkem není zakladatelská dvojice, ale investiční společnost
  **ZenX Capital, a.s.** — od října 2020 drží 45,8–50 % [CLM-52], víc než oba
  zakladatelé dohromady (2× 17,63 %) [CLM-53].
- **Petr Faraga** nebyl "nově příchozí drobný společník", ale spoluzakladatel
  s třetinovým podílem a jednatelskou funkcí v letech 2012–2020 [CLM-34].
- **Mindee app** (95 %) a **Verzuz.com** (100 %) jsou dceřiné společnosti
  Able.cz [CLM-28] [CLM-30]; **FaMe trade** je aktivní s Václavem Faragou
  jako současným 50% společníkem — dřívější zrcadlový záznam o "ukončené"
  firmě byl chybný [CLM-32].

Většina marketingových a výkonnostních tvrzení firmy zůstává **tvrzením firmy**
a čeká na nezávislé potvrzení; oficiální registr smluv nevrací pro Able.cz ani
Blackfish žádnou zveřejněnou smlouvu [CLM-57]. Rozpor v čísle spisu (CON-01)
zůstává viditelný; rozpor CON-02 (one label s.r.o.) byl **vyřešen primárním
záznamem** a přibyl nový rozpor CON-03 (mediální vs. rejstříkové datum
Oslzlova vlastnictví Blackfish).

Důvěra je **střední**: vysoká u identity a vlastnické struktury (nyní primárně
ověřené), nízká u výkonnostních tvrzení, s reálnými mezerami vyznačenými napříč
textem — včetně stavu **BLOCKED** tam, kde úřední zdroj selhal (insolvenční
rejstřík, HTTP 500) [CLM-58].

## Rozsah, metodologie a politika oprav

Evidence je označena stavem: **VERIFIED_PRIMARY** (přímý primární zdroj),
**CORROBORATED** (dva nebo více skutečně nezávislých rodin zdrojů),
**SELF_REPORTED** (tvrzení Able nebo přidružené strany), **ASSESSED**
(analytické čtení), **CONTRADICTED** (zdroje si věcně odporují), **NOT_FOUND**
(dotaz uspěl a záznam tam není) a **BLOCKED** (zdroj nešlo technicky či právně
dotázat — nikdy se nevydává za "nenalezeno"). Tyto stavy nejsou sloučeny do
jednoho skóre. Zrcadla téhož upstreamu (kurzy.cz, Hlídač státu, Northdata …
vše republikuje or.justice.cz) tvoří **jednu rodinu zdrojů** a nikdy se
nepočítají jako nezávislé potvrzení. Opravy jsou vítány a budou datovány.

Průchod 18. 7. 2026 doplnil **důkazní vrstvu**: úřední záznamy ARES/VR všech
19 entit byly staženy oficiálním REST API, uloženy content-addressed
(SHA-256) a strojově rozloženy na 453 rejstříkových tvrzení s JSON-pointerem
do zachovaného artefaktu; podané listiny nesou citace na přesný řádek. Dřívější
tvrzení, která míchala fakt s hodnocením nebo se opírala jen o zrcadla, byla
**rozdělena a nahrazena** (auditní stopa je v datech i v
`docs/dossier/evidence/`). Tam, kde přesnější evidence dřívější záznam vyvrátila,
je oprava uvedena výslovně — viz CORRECTIONS.md.

## Identita — *Ověřeno primárně*

Able.cz s.r.o. je společnost s ručením omezeným založená **3. října 2012** —
původně jako **BIT CONSULTING s.r.o.** u Městského soudu v Praze (C 200323);
v listopadu 2014 byl spis přenesen ke Krajskému soudu v Brně (C 85425) a
14. listopadu 2016 byla firma přejmenována na Able.cz s.r.o. Sídlo je
**Vlněna 526/5, Trnitá, 602 00 Brno**, IČO **24278815**, DIČ **CZ24278815**,
základní kapitál **243 715 Kč** (navýšen z 210 000 Kč dne 14. 11. 2024).
Každý z těchto údajů je ověřen proti zachovanému úřednímu záznamu [SRC-12];
úplná tabulka pole-po-poli se zdroji je uvedena níže.

## Rozpor v čísle spisu soudu — *V rozporu*

Vlastní GDPR stránka firmy uvádí spisovou značku **C 85424**; veřejný rejstřík
eviduje **C 85425**. Rejstřík je autoritativní, takže C 85425 je platná
hodnota a číslo na stránce je nejpravděpodobněji chyba přepisu nebo zastaralá
kopie. Je to zaznamenáno, ne tiše opraveno, protože due diligence dokument,
který skrývá nalezené rozpory, má menší hodnotu než ten, který je ukazuje.

## Řízení a vlastnictví — *Ověřeno primárně, s korekcemi*

Statutární orgán tvoří **Václav Faraga** a **Tomáš Melichárek** (oba jednatelé
od založení); třetím jednatelem byl v letech **2012–2020 Petr Faraga** — fakt,
který zrcadlové průchody nezachytily [CLM-34]. Dozorčí rada existuje od
října 2020 (Libor Polanský) a vznikla ve stejné restrukturalizaci, v níž do
firmy vstoupila **ZenX Capital, a.s.** s tehdy 50% podílem.

Aktuální kapitálová tabulka (primárně ověřená, součet 100,00 %): ZenX Capital
**45,80 %** [CLM-52], V. Faraga **17,63 %**, T. Melichárek **17,63 %**,
V. Schlesinger **5,00 %** [CLM-22], 5326G s.r.o. (vozidlo Marka Kříže)
**4,09 %** [CLM-55], F. Juren **3,32 %**, R. Juhaňák **2,30 %**, O. Kaman
**1,50 %** [CLM-36], J. Kaman **1,00 %**, M. Nakládal **0,73 %**, T. Kořenský
**0,50 %** a P. Faraga **0,50 %**. Restrukturalizace z **29. července 2025**
zapsala sedm nových společníků v jediném dni — rejstříková stopa transakce
Blackfish [CLM-54]. Úkony nad **200 000 Kč** vyžadují společné jednání
jednatelů (pravidlo zatím doloženo jen rodinou rejstříkových zrcadel — ARES
VR způsob jednání neexponuje).

Web marketingově prezentuje čtyři vedoucí osobnosti, včetně **CTO (Lukáš
Grolig)** a **CSO (Radek Juhaňák)**. Marketingový titul není totéž co
statutární funkce: kompletní zachovaná historie rejstříku 2012–2026 Grologa
neobsahuje v žádné roli [CLM-38] a jeho vlastní firmy (VERASTO — 100 %,
BGO — ukončeno 2026, Usporix — založeno v červnu 2026, 100 %) nemají s Able.cz
klastrem žádný průnik [CLM-37]. Juhaňák je společník (2,30 %), nikoli
statutární orgán. Graf níže ukazuje vztah každé osoby k firmě a evidenci za ním.

## Veřejná tvrzení — *Většinou tvrzení firmy*

Able publikuje rozsáhlou sadu výkonnostních tvrzení — 150+ interních AI agentů,
300% průměrné ROI klientů, >90% snížení chybovosti a několik kvantifikovaných
klientských výsledků. Jak ukazuje graf stavů, **14 z 15 posuzovaných věcných
tvrzení je tvrzením firmy**: publikováno firmou, nezávisle nepotvrzeno.
Jmenovaný klient je důkazem, že vztah byl uveden, ne že kvantifikovaný výsledek
nastal; marketingový text je důkazem pozicování, ne schopnosti. Každá
z citovaných formulací je zachycena v uloženém snímku webu s otiskem SHA-256
— přesné znění se otevře v důkazní vrstvě [CLM-01] [CLM-06] [CLM-07]. Jedinou
**potvrzenou** položkou je akvizice produktového studia **Blackfish** z roku
2025, uvedená konzistentně dvěma nezávislými médii — a potvrzená i primárně
na úrovni rejstříku [CLM-21]. K tvrzení o "4 vyhraných tendrech" registr
smluv nevrací žádnou zveřejněnou smlouvu s Able.cz ani Blackfish jako stranou
[CLM-57] — to tvrzení nevyvrací (povinnost uveřejnění má jen část smluv),
ale žádná veřejná kotva pro něj nalezena nebyla.

## Finanční profil — *Ověřeno z podané účetní závěrky, řádek po řádku*

Podaná účetní závěrka za rok 2024 (Sbírka listin, C 85425/SL68/KSBR, podáno
5. 12. 2025) je uložena včetně textové extrakce a každá hodnota níže nese
citaci na **konkrétní řádek výkazu** — rozklikněte ji v důkazní vrstvě.
Tržby z prodeje výrobků a služeb činily **36 319 tis. Kč** (2023:
42 642 tis.); **čistý obrat** 36 319 tis. Kč (2023: 43 079 tis.) — dvě různé
podané veličiny, které dřívější text spojoval do jedné [CLM-44]. Výsledek
hospodaření byl v obou letech kladný, ale tenký a klesající (631 vs. 844 tis.
Kč). Meziroční pokles tržeb (~14,8 %) je výrazně pod médii uváděným
kombinovaným cílem ~100 mil. Kč — to je ovšem **hodnocení**, srovnání podaného
výsledku s výhledovým tvrzením firmy [CLM-45]. Osobní náklady klesly o ~41 %,
"Služby" (38 734 tis. Kč) jsou zdaleka nejvyšší nákladová položka a závazky ke
společníkům se ztrojnásobily (3,1 → 10,0 mil. Kč); čtení "kontraktorský model"
je analytická interpretace nákladových řádků, ne podaný fakt. Počet zaměstnanců
v závěrce není a zůstává NOT_FOUND. Rozvaha také vykazuje podíly v ovládaných
osobách (1 430 tis. Kč) — konzistentní s rejstříkově doloženými dceřinými
firmami Mindee app a Verzuz.com [CLM-28] [CLM-30]. Blackfish sama podává jako
mikro jednotka: aktiva 6,7–8,3 mil. Kč [CLM-49] — většina "kombinované"
velikosti pochází z Able.cz [CLM-50].

Právní events, přesně podle listin: 19. ledna 2026 vydal exekutor šest
exekučních příkazů proti **Tomáši Melichárkovi osobně** (účty, příjmy, movité
a nemovité věci a obchodní podíly včetně podílu v Able.cz) pro pohledávku
**9 327,14 Kč** Dopravního podniku hl. m. Prahy [CLM-46]; exekuce skončila
24. 3. 2026 vymožením. Rejstřík ukazuje souběžné pře-zápisy jeho podílů ve
čtyřech firmách v lednu–dubnu 2026 [CLM-47]. Že jde nejspíš o eskalovanou
pokutu z MHD, je **hodnocení** — listiny původ dluhu neuvádějí [CLM-48].
Vůči firmě samotné nebyla nalezena žádná exekuce; insolvenci **nebylo možné
ověřit** — ISIR oba dny vracel HTTP 500 (stav BLOCKED, ne "čisto") [CLM-58].

## Rozšířená síť vztahů — *Faraga / Melichárek / Juhaňák / Kaman / Schlesinger klastr*

Rekurzivní research veřejného rejstříku (hloubka 2 od Able.cz a Blackfish),
nyní **plně primárně doložený** zachovanými záznamy ARES/VR, ukazuje Able.cz
jako uzel v širším znojemsko-pražském podnikatelském klastru:

- **Mindee app s.r.o.** je od založení 2017 většinově vlastněná přímo Able.cz
  (dnes 95 %; Melichárek jednatelem od 2017, V. Faraga od 2024) [CLM-28]
  a **Verzuz.com s.r.o.** (zal. prosinec 2025) je 100% dcera Able.cz [CLM-30]
  — obojí dřívější zrcadlový průchod minul.
- **ERA25 s.r.o.** (zal. srpen 2025) spoluvlastní oba zakladatelé po 39,5 %
  s Františkem Jurenem (21 %), který je zároveň společníkem Able.cz [CLM-29].
- **FaMe logistics s.r.o. v likvidaci** drží trojice V. Faraga (33 %,
  likvidátor), P. Faraga (34 %) a Melichárek (33 %) [CLM-31]; **FaMe trade**
  je aktivní, V. Faraga v ní od prosince 2020 drží 50 % — oprava dřívějšího
  chybného záznamu o ukončení [CLM-32]; **M&M plan** je Melichárkova osobní
  firma [CLM-33].
- **Petr Faraga** (nar. 1966) je spoluzakladatel Able.cz/BIT CONSULTING
  (1/3 podíl 2012, jednatel 2012–2020) a 29. 7. 2025 se vrátil s 0,50 %
  [CLM-34]. Rodinný vztah k Václavu Faragovi (nar. 1989) zůstává věrohodnou,
  ale nikde nepotvrzenou domněnkou [CLM-35] — stejně jako u čtvrtého nositele
  příjmení, Martina Patrika Faragy (FaMe logistics 2013–2015).
- **one label s.r.o.**: rozpor CON-02 je vyřešen primárním záznamem —
  J. Kaman 36 % (jednatel od 2014), O. Kaman 34 %, R. Juhaňák 30 % (oba
  jednatelé od 2022) [CLM-19]; O. Kaman navíc drží přímo 1,50 % Able.cz
  [CLM-36].
- **Blackfish & Co. s.r.o.** (do 2020 Black Fish Digital s.r.o.): vlastnická
  historie je členitější, než uváděla zrcadla — Schlesinger 100 % (2017–18),
  třetiny s Caldrem a Veteškou (2018–20), znovu 100 % (2020–22), 70/30
  s Oslzlou (2022–24), 100 % (2024–25) a od 29. 7. 2025 **Able.cz 100 %**
  [CLM-21]. Schlesinger recipročně získal přesně **5,00 %** Able.cz [CLM-22]
  — fakt, který mediální pokrytí akvizice neuvádí [CLM-51].
- **Únor 2024, zrcadlová výměna**: 13. 2. byla Lovs & Co. s.r.o. přejmenována
  na **Artstay s.r.o.** (dřívější záznam měl směr přejmenování obráceně),
  Schlesinger z ní odešel a Oslzla ji převzal na 100 % — deset dní předtím,
  než Oslzla dokončil odchod z Blackfish a Schlesinger ji převzal na 100 %
  [CLM-41] [CLM-42]. Čtení "dohodnuté rozdělení dvou podniků" je hodnocení
  [CLM-43]; důvod nikde uveden není. Mediální tvrzení z 2021, že Oslzla už
  tehdy držel ~30 % Blackfish, rejstřík nepotvrzuje (CON-03).

## 🚩 Nezveřejněné souběžné angažmá — Ventoux Studio

Vít Schlesinger drží **30 %** společnosti **Ventoux Studio s.r.o.** od jejího
založení **22. září 2025** — zhruba dva měsíce po uzavření akvizice Blackfish;
jednatelkami jsou Andrea Naštická a Nathalie Gabrielle Peyrichout (každá 35 %),
Schlesinger jednatelem není [CLM-39]. Tento podíl není zmíněn v žádném
z dohledaných mediálních zdrojů o akvizici (Forbes.cz, CzechCrunch) [CLM-40].
Je to označeno jako mezera ve veřejné transparentnosti, **ne jako důkaz
pochybení** — souběžný soukromý podíl není u aktivního podnikatele nic
neobvyklého, ale chybí v každém veřejném popisu obchodu, který byl prověřen.

## Otevřené a vyřešené otázky

Nevyřešené položky — nezávislé potvrzení klientských výsledků, grantová
expozice, skuteční vlastníci ZenX Capital, cena akvizice Blackfish, důvod
Oslzlova odchodu, rodinné vztahy Faragů, insolvence (BLOCKED) — jsou uvedeny
v plném rozsahu níže. Otázky, které pozdější sběr důkazů uzavřel (podané
závěrky, rozdělení podílů one label, statutární status marketingových rolí,
"nedosažitelnost" primárního rejstříku), se nepřepisují mlčky: přesouvají se
do sekce **Vyřešené otázky** s odkazem na důkaz, který je vyřešil.

## Prohlášení

Tato stránka posuzuje **pouze veřejné zdroje**, k datu evidence, a je snímkem
v čase, který se bude s vývojem záznamu měnit. **Není** to právní, finanční ani
investiční poradenství a neobsahuje žádné tvrzení o insolvenci, pochybení ani
protiprávním jednání — žádné nebylo nalezeno ani naznačeno. Interpretace
(*Assessed*) jsou odděleny od faktů (*Verified*) v celém textu. Opravy budou
datovány a připsány.
