// The quiet hourglass: the "Only what needs you." section's illustration, drawn as
// one flat vector scene (paths, shapes and gradients only). A blush-pink hourglass
// with aubergine caps, translucent glass, sand mounds above and below the narrow
// neck and a dotted falling stream, a green leaf sprig curling up behind its
// lower-left, and a soft ground shadow that runs on beneath the section's card.
// Decoration for sighted visitors: the section's own text carries the meaning.
export function QuietHourglass() {
  return (
    <svg viewBox="40 20 1240 780" aria-hidden="true" focusable="false" className="quiet-hourglass-art">
      <defs>
        <linearGradient id="qh-cap" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#785859"/>
          <stop offset=".35" stopColor="#5d4144"/>
          <stop offset="1" stopColor="#3d2629"/>
        </linearGradient>
        <linearGradient id="qh-cap-face" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#7d5d5e"/>
          <stop offset=".5" stopColor="#694a4c"/>
          <stop offset="1" stopColor="#553a3d"/>
        </linearGradient>
        <linearGradient id="qh-glass" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#f9dad3"/>
          <stop offset=".1" stopColor="#fce5e0"/>
          <stop offset=".85" stopColor="#fce5e0"/>
          <stop offset="1" stopColor="#f7d5cd"/>
        </linearGradient>
        <linearGradient id="qh-sand" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f7cabe"/>
          <stop offset="1" stopColor="#f3bdb0"/>
        </linearGradient>
        <linearGradient id="qh-leaf" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#8a916a"/>
          <stop offset="1" stopColor="#788260"/>
        </linearGradient>
        <linearGradient id="qh-ground-long" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#f1d6cf" stopOpacity="0"/>
          <stop offset=".22" stopColor="#f0d3cc"/>
          <stop offset=".78" stopColor="#f0d3cc"/>
          <stop offset="1" stopColor="#f1d6cf" stopOpacity="0"/>
        </linearGradient>
        <radialGradient id="qh-ground" cx=".5" cy=".5" r=".5">
          <stop offset="0" stopColor="#e9c4bb"/>
          <stop offset="1" stopColor="#f1d6cf" stopOpacity="0"/>
        </radialGradient>
        <clipPath id="qh-glass-clip">
          <path d="M345 100V175C347 235 372 290 440 340C490 376 512 392 519 418C520 428 521 434 519 442C513 466 488 480 440 508C370 552 347 600 345 652V727C345 735 410 738 527 738C644 738 710 735 710 727V652C708 600 685 552 615 508C567 480 542 466 536 442C534 434 535 428 536 418C543 392 566 376 615 340C683 290 708 235 710 175V100Z"/>
        </clipPath>
      </defs>
      {/* ground shadow */}
      <ellipse cx="660" cy="760" rx="610" ry="8" fill="url(#qh-ground-long)"/>
      <ellipse cx="625" cy="768" rx="345" ry="19" fill="url(#qh-ground)"/>
      <ellipse cx="560" cy="772" rx="270" ry="12" fill="#eac4bb" opacity=".7"/>
      {/* leaf sprig */}
      <g>
        <path d="M328 726C312 692 297 650 293 602C289 560 278 522 268 498" fill="none" stroke="#74805a" strokeWidth="6" strokeLinecap="round"/>
        <path d="M302 672C292 658 280 647 268 640" fill="none" stroke="#6e7853" strokeWidth="3.5" strokeLinecap="round"/>
        <path d="M268 502C208 486 176 410 192 347C256 366 300 440 268 502Z" fill="url(#qh-leaf)"/>
        <path d="M268 502C262 450 238 392 192 347C214 400 230 450 268 502Z" fill="#6f7a56" opacity=".4"/>
        <path d="M298 594C288 542 318 490 368 470C380 522 350 574 298 594Z" fill="url(#qh-leaf)"/>
        <path d="M298 594C312 540 336 500 368 470C340 510 318 548 298 594Z" fill="#6f7a56" opacity=".38"/>
        <path d="M268 641C200 642 140 602 113 545C182 538 252 566 268 641Z" fill="url(#qh-leaf)"/>
        <path d="M268 641C216 616 160 578 113 545C170 570 228 604 268 641Z" fill="#6f7a56" opacity=".38"/>
        <path d="M268 498C258 440 232 390 196 352M298 594C316 538 338 504 364 476M268 641C214 612 160 578 120 548" fill="none" stroke="#5d6847" strokeWidth="2.4" strokeLinecap="round" opacity=".5"/>
      </g>
      {/* glass */}
      <g>
        <path d="M345 100V175C347 235 372 290 440 340C490 376 512 392 519 418C520 428 521 434 519 442C513 466 488 480 440 508C370 552 347 600 345 652V727C345 735 410 738 527 738C644 738 710 735 710 727V652C708 600 685 552 615 508C567 480 542 466 536 442C534 434 535 428 536 418C543 392 566 376 615 340C683 290 708 235 710 175V100Z" fill="url(#qh-glass)"/>
        <g clipPath="url(#qh-glass-clip)">
          {/* upper sand */}
          <path d="M400 262C440 252 482 262 520 279C560 284 606 268 646 272C622 312 580 346 552 384L538 424H517L506 388C480 360 430 308 400 262Z" fill="url(#qh-sand)"/>
          <path d="M646 272C622 312 580 346 552 384L538 424H533C545 384 580 330 604 290C620 282 634 276 646 272Z" fill="#eeb3a6" opacity=".6"/>
          {/* lower sand */}
          <path d="M345 722C380 700 440 672 490 640C515 624 524 617 530 617C560 632 620 680 706 712V738H345Z" fill="url(#qh-sand)"/>
          <path d="M530 617C560 640 610 682 710 706V738H600C640 700 600 664 530 617Z" fill="#ecaea0" opacity=".75"/>
          <path d="M350 718C400 706 470 700 540 706C600 712 650 716 710 716V738H345Z" fill="#eeb1a4" opacity=".6"/>
          {/* falling stream */}
          <g fill="#ecb4a7">
            <circle cx="527" cy="440" r="3.6"/>
            <circle cx="527" cy="456" r="3.4"/>
            <circle cx="528" cy="472" r="3.4"/>
            <circle cx="527" cy="490" r="3.4"/>
            <circle cx="528" cy="508" r="3.5"/>
            <circle cx="529" cy="526" r="3.5"/>
            <circle cx="527" cy="545" r="3.6"/>
            <circle cx="528" cy="562" r="3.6"/>
            <circle cx="528" cy="580" r="3.7"/>
            <circle cx="527" cy="598" r="3.8"/>
          </g>
          <path d="M520 418C525 426 530 426 535 418V446H520Z" fill="#f2bcaf"/>
          {/* glass edge shading */}
          <path d="M345 100V175C347 235 372 290 440 340C490 376 512 392 519 418C520 428 521 434 519 442C513 466 488 480 440 508C370 552 347 600 345 652M710 100V175C708 235 683 290 615 340C567 376 543 392 536 418C535 428 534 434 536 442C542 466 567 480 615 508C685 552 708 600 710 652" fill="none" stroke="#f1bfb4" strokeWidth="22" opacity=".35"/>
          {/* glass sheen */}
          <path d="M366 130C378 122 392 140 392 168C392 200 388 226 378 236C366 244 362 200 362 168C362 150 362 136 366 130Z" fill="#fdeee9" opacity=".8"/>
          <path d="M446 500C460 488 482 490 468 508C436 552 404 596 396 642C392 654 380 646 382 630C388 582 416 534 446 500Z" fill="#fef0eb" opacity=".8"/>
          <path d="M350 112H392V180C370 200 356 190 350 180Z" fill="#fff" opacity=".12"/>
          <path d="M690 130C700 190 692 230 662 270" fill="none" stroke="#fdeee9" strokeWidth="6" strokeLinecap="round" opacity=".55"/>
          <path d="M660 580C682 610 694 640 700 690" fill="none" stroke="#fdeee9" strokeWidth="5" strokeLinecap="round" opacity=".5"/>
        </g>
        <path d="M345 100V175C347 235 372 290 440 340C490 376 512 392 519 418C520 428 521 434 519 442C513 466 488 480 440 508C370 552 347 600 345 652M710 100V175C708 235 683 290 615 340C567 376 543 392 536 418C535 428 534 434 536 442C542 466 567 480 615 508C685 552 708 600 710 652" fill="none" stroke="#f0b8ad" strokeWidth="3" opacity=".5"/>
      </g>
      {/* top cap */}
      <g>
        <path d="M324 64C324 50 400 42 527 42C654 42 730 50 730 64V82C730 98 654 106 527 106C400 106 324 98 324 82Z" fill="url(#qh-cap)"/>
        <ellipse cx="527" cy="63" rx="203" ry="20" fill="url(#qh-cap-face)"/>
        <path d="M340 80C380 94 450 98 527 98C610 98 690 94 716 80V84C700 100 640 106 527 106C410 106 346 98 340 84Z" fill="#3b2528" opacity=".55"/>
        <ellipse cx="478" cy="86" rx="62" ry="9" fill="#836364" opacity=".55"/>
      </g>
      {/* bottom cap */}
      <g>
        <path d="M324 736C324 722 400 714 527 714C654 714 730 722 730 736V750C730 766 654 774 527 774C400 774 324 766 324 750Z" fill="url(#qh-cap)"/>
        <ellipse cx="527" cy="734" rx="203" ry="18" fill="url(#qh-cap-face)"/>
        <path d="M340 752C380 764 450 767 527 767C610 767 690 764 716 752V756C700 770 640 774 527 774C410 774 346 768 340 756Z" fill="#3b2528" opacity=".55"/>
        <ellipse cx="478" cy="755" rx="62" ry="8" fill="#836364" opacity=".5"/>
      </g>
    </svg>
  );
}
