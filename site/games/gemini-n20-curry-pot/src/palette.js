// Palette matched directly to refs/ref_front_iso.jpg, refs/ref_back_iso.jpg, and refs/ref_props_turnaround.jpg
window.PAL = {
  // Backdrop & outlines
  bgCenter: '#FCE6BC',
  bgEdge: '#F2CE96',
  outline: '#381F15',
  shadow: 'rgba(66, 36, 18, 0.22)',

  // Walnut turntable base
  walnutTop: '#965831',
  walnutMid: '#7A4323',
  walnutDark: '#5B2E16',
  walnutEdge: '#472210',

  // Floors
  tileCream: '#FBF2DE',
  tileCreamShade: '#EFE2C5',
  tileButter: '#F4CF82',
  tileButterShade: '#E2B868',
  tileGrout: '#DEC497',

  oakLight: '#DF9B4F',
  oakMid: '#CE863E',
  oakDark: '#B8712E',
  oakSeam: '#8F5422',

  // Kitchen counter
  cabLight: '#F4E5C2',
  cabMid: '#E8D4AA',
  cabPanel: '#DBC191',
  cabRecess: '#C4A573',
  cabKnob: '#9B5A29',
  butcherTop: '#D88F45',
  butcherLight: '#E5A257',
  butcherDark: '#BA7330',
  butcherGrain: '#AD6627',

  // Cutting board & knife
  boardTop: '#EAB46C',
  boardLight: '#F3C582',
  boardSide: '#C78640',
  knifeBlade: '#DCE3EA',
  knifeShine: '#F6F9FC',
  knifeEdge: '#9AA6B3',
  knifeHandle: '#7B4628',
  knifeHandleDark: '#5B311A',

  // Vegetables
  carrotMain: '#F26F21',
  carrotLight: '#FF9442',
  carrotDark: '#C94B14',
  carrotLeaf: '#399640',
  carrotLeafLight: '#5DC053',

  potatoMain: '#E3B460',
  potatoLight: '#F3CE84',
  potatoDark: '#B9873B',
  potatoInside: '#FAECA8',

  onionMain: '#ECC67E',
  onionLight: '#FBE3B0',
  onionDark: '#C4944B',
  onionInside: '#FFF8E2',

  brocDark: '#267834',
  brocMid: '#3E9D44',
  brocLight: '#68C454',
  brocStem: '#83C05D',

  // Gas stove
  stoveTop: '#F3EBDA',
  stoveSide: '#E5DAC4',
  stoveShade: '#CEC0A8',
  stoveVent: '#7A7268',
  stoveDoor: '#EFE5D1',
  stoveOvenFrame: '#7F7B7E',
  stoveOvenGlass: '#4B474D',
  stoveOvenGlassHi: '#6E6972',
  stoveGrate: '#3E3C44',
  stoveGrateHi: '#5A5863',
  stoveKnob: '#D93B3A',
  stoveKnobHi: '#F3625C',
  stoveKnobDark: '#9E2325',
  stoveFoot: '#483D3A',

  // Blue gas flame
  flameOuter: '#2590F5',
  flameMid: '#5ED4FF',
  flameCore: '#E2FCFF',

  // Cherry-red enamel curry pot
  potRed: '#D8313A',
  potLight: '#F0565C',
  potDark: '#A81F29',
  potDeep: '#7A141D',
  potRim: '#D6CFC7',
  potInner: '#56291D',

  // Wooden ladle
  ladleWood: '#BE7435',
  ladleLight: '#DA9350',
  ladleDark: '#8F4E1E',

  // Rice cooker
  cookerWhite: '#F7F3EC',
  cookerShade: '#E2DBD0',
  cookerDark: '#C5BCB0',
  cookerPanel: '#8C877E',
  cookerScreen: '#56534C',
  cookerInner: '#4A4645',
  cookerCord: '#3A3432',

  // Curry roux tray & bar
  trayLight: '#E5EBF0',
  trayMid: '#C3CCD5',
  trayDark: '#8E99A5',
  rouxTop: '#734227',
  rouxLight: '#8E5736',
  rouxMid: '#5D321B',
  rouxDark: '#442211',

  // Pickle jar (fukujinzuke)
  jarGlass: '#E4EEF2',
  jarGlassHi: '#FFFFFF',
  jarLid: '#D83B3E',
  pickleRed: '#D92638',
  pickleDark: '#9E1826',

  // Dining table & chairs
  tableTop: '#DC9548',
  tableLight: '#E9A95E',
  tableDark: '#BA7431',
  chairWood: '#C9803B',
  chairLight: '#DE9850',
  chairDark: '#9A5B24',

  // Placemats, plates, spoons, rice
  matLight: '#EAD1A3',
  matDark: '#D4B682',
  spoonLight: '#E2E9F0',
  spoonDark: '#9AA5B1',
  plateWhite: '#FFFFFF',
  plateShade: '#E5DFD5',
  plateRim: '#CFC7BA',
  riceWhite: '#FFFDF8',
  riceShade: '#EAE3D4',

  // Family members (from ref_props_turnaround.jpg)
  skinLight: '#FDE0C0',
  skinMid: '#F6C69F',
  skinShade: '#DF9F77',
  cheek: '#F59889',
  eye: '#381F15',

  // Mama
  mamaHair: '#7E4528',
  mamaHairHi: '#9E5D38',
  mamaHairDark: '#592E18',
  mamaTop: '#F38B73',
  mamaTopHi: '#FFA891',
  mamaTopDark: '#D26B54',
  mamaPants: '#4C677B',
  mamaPantsDark: '#364C5C',

  // Papa
  papaHair: '#4C362B',
  papaHairHi: '#684C3D',
  papaHairDark: '#35241C',
  papaShirt: '#F4F0E6',
  papaCardi: '#749484',
  papaCardiHi: '#90B0A0',
  papaCardiDark: '#567365',
  papaPants: '#7A5B41',

  // Little Girl
  girlHair: '#4A3127',
  girlHairHi: '#664638',
  girlHairDark: '#332018',
  girlRibbon: '#DE373B',
  girlRibbonHi: '#F86364',
  girlDress: '#FADE64',
  girlDressHi: '#FFF08F',
  girlDressDark: '#DFB63B',
  girlCollar: '#FFF9EC',
};

window.ColorUtil = {
  hexToRgb(hex) {
    const h = hex.replace('#', '');
    return [
      parseInt(h.slice(0, 2), 16),
      parseInt(h.slice(2, 4), 16),
      parseInt(h.slice(4, 6), 16),
    ];
  },
  rgbToHex(r, g, b) {
    const c = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
    return '#' + c(r) + c(g) + c(b);
  },
  lerpHex(hexA, hexB, t) {
    const a = this.hexToRgb(hexA);
    const b = this.hexToRgb(hexB);
    const k = Math.max(0, Math.min(1, t));
    return this.rgbToHex(
      a[0] + (b[0] - a[0]) * k,
      a[1] + (b[1] - a[1]) * k,
      a[2] + (b[2] - a[2]) * k
    );
  },
  shadeHex(hex, factor) {
    const [r, g, b] = this.hexToRgb(hex);
    return this.rgbToHex(r * factor, g * factor, b * factor);
  },
  // Curry liquid color curve from clear simmering water -> golden broth -> rich velvety Japanese curry
  curryColors(richness, veggieRatio) {
    // richness: 0..4 (number of melted roux cubes, continuous)
    // veggieRatio: 0..1 (simmered vegetable stock warmth)
    const r = Math.max(0, Math.min(4, richness));
    const v = Math.max(0, Math.min(1, veggieRatio));
    const stops = [
      { t: 0, main: this.lerpHex('#87CCF0', '#B6DCA8', v * 0.65), hi: this.lerpHex('#BDE8FC', '#E3F2C4', v * 0.65), dark: this.lerpHex('#59A7D6', '#84B57E', v * 0.65) },
      { t: 1, main: '#D6A548', hi: '#F0CA73', dark: '#AD7B2C' },
      { t: 2, main: '#C47E28', hi: '#E4A148', dark: '#965A1A' },
      { t: 3, main: '#A55B1B', hi: '#C97B30', dark: '#7C3E10' },
      { t: 4, main: '#8B4514', hi: '#B96A26', dark: '#632D0A' },
    ];
    let i = 0;
    while (i < stops.length - 2 && r > stops[i + 1].t) i++;
    const a = stops[i];
    const b = stops[i + 1];
    const f = (r - a.t) / (b.t - a.t);
    return {
      main: this.lerpHex(a.main, b.main, f),
      hi: this.lerpHex(a.hi, b.hi, f),
      dark: this.lerpHex(a.dark, b.dark, f),
    };
  },
};
