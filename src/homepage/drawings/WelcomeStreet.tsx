// The welcome street: the closing banner of the homepage, drawn as one flat vector scene
// (paths, shapes and gradients only). A blush sky with two cream clouds and a peach sun sits
// over faint city blocks; five small houses stand in a row, each with warm glowing windows,
// a front door and a chimney, among iron fences, rounded bushes and stylised trees, above a
// pale pavement. The three middle houses carry the scene when the banner is cropped narrow.
// Decoration for sighted visitors: the section's own text carries the meaning.

const OUT = "#2c1e21";
const WALL = "#fbf4ea";
const DOOR = "#e0665f";
const LEAF = "#5d6b4b";
const LEAF_DARK = "#4d5b3f";

const CLOUD =
  "M302 127C302 113 318 107 336 108C346 90 372 88 388 98C396 70 430 56 458 66C478 74 486 88 486 98C510 98 527 110 527 127Z";

// An iron fence: pointed pickets between two rails.
function fence(x: number, width: number, top = 497, bottom = 550) {
  let pickets = "";
  for (let px = x; px <= x + width - 4; px += 13) {
    pickets += `M${px} ${bottom}V${top + 5}L${px + 2} ${top}L${px + 4} ${top + 5}V${bottom}Z`;
  }
  return (
    <g>
      <path d={pickets} fill={OUT} />
      <rect x={x} y={top + 14} width={width} height="4" fill={OUT} />
      <rect x={x} y={bottom - 16} width={width} height="4" fill={OUT} />
    </g>
  );
}

// A glowing window: cream frame, warm glass, mullions, a sill. `panes` adds the cross.
function windowPane(x: number, y: number, w: number, h: number, id: string, cross = true) {
  return (
    <g>
      <rect x={x - 3} y={y - 3} width={w + 6} height={h + 6} rx="2" fill="#fbf1e6" />
      <rect x={x} y={y} width={w} height={h} fill={`url(#${id})`} />
      <ellipse cx={x + w * 0.32} cy={y + h * 0.3} rx={w * 0.26} ry={h * 0.2} fill="#fff0cf" fillOpacity=".3" />
      <ellipse cx={x + w * 0.7} cy={y + h * 0.72} rx={w * 0.24} ry={h * 0.2} fill="#f5a470" fillOpacity=".3" />
      {cross ? (
        <>
          <rect x={x + w / 2 - 1.5} y={y} width="3" height={h} fill="#fbf1e6" />
          <rect x={x} y={y + h / 2 - 1.5} width={w} height="3" fill="#fbf1e6" />
        </>
      ) : null}
    </g>
  );
}

function sill(x: number, y: number, w: number, fill = "#e9d6c7") {
  return <rect x={x} y={y} width={w} height="6" rx="2" fill={fill} />;
}

// A small potted plant standing on a sill.
function plant(x: number, base: number) {
  return (
    <g>
      <path d={`M${x - 8} ${base}L${x - 6} ${base - 15}H${x + 6}L${x + 8} ${base}Z`} fill="#a15a4c" />
      <path
        d={`M${x} ${base - 14}C${x - 4} ${base - 26} ${x - 12} ${base - 28} ${x - 15} ${base - 30}C${x - 10} ${base - 20} ${x - 6} ${base - 18} ${x} ${base - 14}ZM${x} ${base - 14}C${x + 1} ${base - 30} ${x + 3} ${base - 34} ${x + 3} ${base - 38}C${x + 8} ${base - 30} ${x + 5} ${base - 20} ${x} ${base - 14}ZM${x} ${base - 14}C${x + 6} ${base - 24} ${x + 12} ${base - 27} ${x + 16} ${base - 28}C${x + 12} ${base - 20} ${x + 7} ${base - 16} ${x} ${base - 14}Z`}
        fill="#5d6b4b"
      />
    </g>
  );
}

function bush(x: number, base: number, w: number, h: number, dark = false) {
  return (
    <path
      d={`M${x} ${base}C${x - 4} ${base - h * 0.45} ${x + w * 0.08} ${base - h * 0.62} ${x + w * 0.22} ${base - h * 0.62}C${x + w * 0.26} ${base - h * 0.95} ${x + w * 0.5} ${base - h} ${x + w * 0.58} ${base - h * 0.7}C${x + w * 0.8} ${base - h * 0.85} ${x + w * 1.02} ${base - h * 0.4} ${x + w} ${base}Z`}
      fill={dark ? LEAF_DARK : LEAF}
    />
  );
}

export function WelcomeStreet() {
  return (
    <svg viewBox="0 0 2000 608" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false" className="welcome-street-art">
      <defs>
        <clipPath id="street-frame">
          <path d="M24 0H1976Q2000 0 2000 24V556Q2000 608 1948 608H52Q0 608 0 556V24Q0 0 24 0Z" />
        </clipPath>
        <linearGradient id="street-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fadad0" />
          <stop offset=".6" stopColor="#f9d3c8" />
          <stop offset="1" stopColor="#f3bfb0" />
        </linearGradient>
        <linearGradient id="street-glow" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f9b98a" />
          <stop offset=".5" stopColor="#fcd09b" />
          <stop offset="1" stopColor="#f7ae7f" />
        </linearGradient>
        <linearGradient id="street-glow-warm" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f6aa7c" />
          <stop offset=".55" stopColor="#fcd3a0" />
          <stop offset="1" stopColor="#f8b98a" />
        </linearGradient>
        <linearGradient id="street-pave" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ddc3b0" />
          <stop offset="1" stopColor="#d5b9a6" />
        </linearGradient>
        <linearGradient id="street-roof" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#4b3538" />
          <stop offset="1" stopColor="#3a272a" />
        </linearGradient>
      </defs>
      <g clipPath="url(#street-frame)">
        {/* Sky, sun, clouds, faint city blocks */}
        <rect width="2000" height="608" fill="url(#street-sky)" />
        <circle cx="1436" cy="107" r="39" fill="#eba99a" />
        <path d={CLOUD} fill="#fbf1e6" />
        <path d={CLOUD} transform="translate(1160 184) scale(.84) translate(-302 -127)" fill="#fbf1e6" />
        <path d={CLOUD} transform="translate(1648 92) scale(.92) translate(-302 -127)" fill="#fbf1e6" />
        <g fill="#f2c3b4">
          <path d="M458 300V222H523V300Z" />
          <path d="M1507 330V200H1556V160H1611V330Z" />
          <path d="M670 330V232L700 222H730V330Z" />
          <path d="M0 400V380L40 366L80 380V400Z" />
        </g>
        <path d="M0 330C120 300 300 290 520 300C760 310 900 270 1100 300C1300 330 1500 290 1700 310C1850 325 1940 300 2000 310V560H0Z" fill="#f1b6a6" fillOpacity=".7" />
        <rect x="0" y="430" width="2000" height="130" fill="#f0b3a3" fillOpacity=".55" />

        {/* Back trees: the cypresses that stand between the houses */}
        <path d="M712 300C706 200 724 98 772 94C822 92 838 190 828 290C826 350 806 420 790 440H740C722 420 714 350 712 300Z" fill={LEAF} />
        <path d="M712 300C712 340 724 400 744 438H766C740 380 738 330 760 250C770 190 790 120 800 96C750 100 718 200 712 300Z" fill={LEAF_DARK} fillOpacity=".55" />
        <rect x="774" y="420" width="5" height="124" fill={OUT} />
        <path d="M1136 330C1132 240 1150 170 1186 168C1224 170 1234 260 1226 320C1224 370 1200 420 1190 440H1150C1142 410 1137 370 1136 330Z" fill={LEAF} />
        <path d="M1136 330C1136 370 1144 410 1152 438H1172C1152 400 1150 330 1166 260C1174 220 1182 190 1190 170C1156 176 1136 250 1136 330Z" fill={LEAF_DARK} fillOpacity=".55" />
        <rect x="1176" y="420" width="4" height="124" fill={OUT} />

        {/* House 1: cream bungalow with a dark roof and a lit curtained window */}
        <rect x="342" y="195" width="41" height="100" fill={OUT} />
        <rect x="118" y="342" width="292" height="208" fill={WALL} />
        <rect x="118" y="342" width="292" height="12" fill="#ecdfd1" />
        <path d="M108 343L303 229L322 224L418 343Z" fill="url(#street-roof)" />
        {windowPane(161, 380, 97, 93, "street-glow-warm", false)}
        <path d="M161 380H190Q178 410 186 473H161Z" fill="#f7a98f" fillOpacity=".7" />
        <path d="M258 380H228Q240 410 232 473H258Z" fill="#f7a98f" fillOpacity=".7" />
        <rect x="207" y="380" width="3" height="20" fill={OUT} />
        <path d="M197 413L202 400H215L220 413Z" fill="#f6dfc2" />
        {sill(158, 473, 104)}
        {plant(180, 473)}
        <rect x="301" y="403" width="68" height="147" rx="2" fill={DOOR} />
        <circle cx="316" cy="479" r="4" fill={OUT} />

        {/* House 2: blush gable with a round attic window */}
        <path d="M463 352L615 196L766 352L752 362H478Z" fill="#8d6862" />
        <path d="M494 362L615 232L736 362H750V550H480V362Z" fill="#f6cdc3" />
        <circle cx="615" cy="314" r="31" fill="#fbf1e6" />
        <circle cx="615" cy="314" r="26" fill="url(#street-glow)" />
        <rect x="613" y="288" width="4" height="52" fill={OUT} />
        <rect x="589" y="312" width="52" height="4" fill={OUT} />
        {windowPane(522, 386, 70, 94, "street-glow")}
        {windowPane(638, 386, 69, 94, "street-glow")}
        {sill(517, 480, 80, "#b89a92")}
        {sill(633, 480, 79, "#b89a92")}
        {plant(657, 480)}

        {/* House 3: tall aubergine house with an arched coral door */}
        <rect x="1037" y="108" width="44" height="100" fill={OUT} />
        <path d="M803 228L960 90L1117 228V550H803Z" fill="#3b2629" />
        {windowPane(851, 253, 76, 97, "street-glow-warm", false)}
        {windowPane(993, 253, 76, 97, "street-glow")}
        <path d="M851 253H927V300Q890 285 851 300Z" fill="#fde2b4" fillOpacity=".4" />
        <rect x="887" y="253" width="3" height="14" fill="#6b5a50" />
        <path d="M876 290L884 267H894L902 290Z" fill="#f6dfc2" />
        {sill(846, 350, 86, "#fbf1e6")}
        {sill(988, 350, 86, "#fbf1e6")}
        {plant(1042, 350)}
        <path d="M918 550V440Q918 397 960 397Q1003 397 1003 440V550Z" fill={DOOR} />
        <circle cx="986" cy="479" r="4" fill={OUT} />

        {/* House 4: cream house with a ribbed dark roof and a wide window */}
        <path d="M1170 348L1203 246H1450L1500 348Z" fill="url(#street-roof)" />
        <g stroke="#6b5558" strokeWidth="2" fill="none">
          <path d="M1248 246L1230 348M1292 246L1280 348M1336 246L1332 348M1380 246L1384 348M1424 246L1436 348" />
        </g>
        <rect x="1181" y="348" width="309" height="202" fill={WALL} />
        <rect x="1181" y="348" width="309" height="10" fill="#ecdfd1" />
        {windowPane(1220, 386, 125, 104, "street-glow-warm")}
        <path d="M1345 386H1318Q1328 430 1320 490H1345Z" fill="#f7a98f" fillOpacity=".7" />
        {sill(1217, 490, 131)}
        {plant(1295, 490)}
        <rect x="1384" y="408" width="65" height="142" rx="2" fill={DOOR} />
        <circle cx="1397" cy="480" r="4" fill={OUT} />

        {/* House 5: mauve-brown gable with a round window */}
        <rect x="1822" y="155" width="43" height="95" fill={OUT} />
        <path d="M1612 286L1760 155L1908 286V550H1612Z" fill="#8b6963" />
        <circle cx="1759" cy="296" r="39" fill="#fbf1e6" />
        <circle cx="1759" cy="296" r="33" fill="url(#street-glow)" />
        <rect x="1757" y="266" width="4" height="60" fill={OUT} />
        <rect x="1729" y="294" width="60" height="4" fill={OUT} />
        {windowPane(1660, 378, 70, 100, "street-glow")}
        {windowPane(1788, 378, 70, 100, "street-glow")}

        {/* Left tree, bushes and fences */}
        <path d="M30 450C32 400 38 340 40 296L46 240H82L84 296C80 340 74 400 72 450Z" fill={OUT} />
        <path d="M66 308L122 240L132 248L82 322Z" fill={OUT} />
        <path d="M48 306L6 280L12 270L54 290Z" fill={OUT} />
        <circle cx="70" cy="95" r="128" fill={LEAF} />
        <circle cx="172" cy="206" r="64" fill={LEAF} />
        <circle cx="80" cy="212" r="60" fill="#56643f" />
        <circle cx="4" cy="205" r="48" fill="#56643f" />
        <circle cx="168" cy="120" r="58" fill={LEAF} />
        {bush(0, 550, 150, 128)}
        {bush(0, 550, 110, 70, true)}
        {bush(70, 550, 80, 60, true)}
        {fence(118, 160)}
        {bush(190, 550, 85, 62)}
        <path d="M408 420C404 360 424 318 445 318C468 318 486 362 482 420C480 450 470 478 462 486H430C418 478 410 450 408 420Z" fill={LEAF} />
        <rect x="443" y="440" width="5" height="108" fill={OUT} />
        <path d="M445 470L428 430M446 450L466 420" stroke={OUT} strokeWidth="3" fill="none" />
        {fence(395, 87)}
        {bush(440, 550, 125, 80)}

        {/* Right of the centre house: bushes, fences, tree */}
        {bush(688, 550, 170, 90)}
        {bush(760, 550, 100, 44, true)}
        {fence(748, 58)}
        {bush(1050, 550, 130, 90)}
        {fence(1117, 63)}
        {bush(1180, 550, 80, 38, true)}
        {bush(1250, 550, 110, 44)}
        <path d="M1490 400C1488 330 1512 285 1550 283C1590 285 1612 340 1610 400C1608 440 1590 470 1570 478H1530C1508 470 1492 440 1490 400Z" fill={LEAF} />
        <path d="M1490 400C1492 440 1508 468 1530 477H1548C1520 450 1510 410 1520 360C1526 330 1536 300 1550 285C1510 290 1490 340 1490 400Z" fill={LEAF_DARK} fillOpacity=".5" />
        <rect x="1548" y="370" width="5" height="176" fill={OUT} />
        <path d="M1550 450L1530 408M1551 430L1572 395" stroke={OUT} strokeWidth="3" fill="none" />
        {fence(1477, 113, 487)}
        {bush(1570, 550, 140, 78)}
        {bush(1640, 550, 120, 50, true)}

        {/* Right tree and hedge */}
        <path d="M1912 330C1896 250 1930 66 1976 66C1996 66 2000 90 2000 130V480C1950 480 1920 420 1912 330Z" fill={LEAF} />
        <path d="M1934 330C1926 270 1938 150 1962 92C1950 170 1948 260 1958 340C1964 390 1970 440 1978 478H1952C1940 440 1934 380 1934 330Z" fill={LEAF_DARK} fillOpacity=".45" />
        <rect x="1969" y="219" width="5" height="261" fill={OUT} />
        <path d="M1971 335L1942 290M1972 320L1996 270" stroke={OUT} strokeWidth="3" fill="none" />
        {bush(1816, 550, 130, 62, true)}
        {bush(1890, 550, 120, 80)}

        {/* Pavement */}
        <rect x="0" y="552" width="2000" height="56" fill="url(#street-pave)" />
        <rect x="0" y="552" width="2000" height="4" fill="#c9ab98" fillOpacity=".7" />
        <rect x="0" y="594" width="2000" height="14" fill="#cdac9b" />
        <path d="M120 594L160 558M390 594L388 558M672 594L676 558M880 594L884 558M1030 594L1034 558M1180 594L1188 558M1370 594L1376 558M1560 594L1570 558M1740 594L1756 558M1860 594L1884 558" stroke="#c9ab98" strokeWidth="2" fill="none" />
      </g>
    </svg>
  );
}
