/**
 * ============================================================================
 * POKÉMON EMERALD VERSION - GBA RPG ENGINE (HTML5 / Vanilla JS)
 * ============================================================================
 */

(function () {
  'use strict';

  // ==========================================================================
  // 1. CONSTANTS & CONFIGURATION
  // ==========================================================================
  const CANVAS_W = 480;
  const CANVAS_H = 320;
  const TILE_SIZE = 32;
  const MAP_COLS = 36;
  const MAP_ROWS = 38;

  const SAVE_KEY = 'POKEMON_EMERALD_SAVE_V1';

  // Game States
  const STATES = {
    TITLE: 'TITLE',
    STARTER_SELECT: 'STARTER_SELECT',
    OVERWORLD: 'OVERWORLD',
    DIALOGUE: 'DIALOGUE',
    BATTLE: 'BATTLE',
    MENU: 'MENU',
    POKEDEX: 'POKEDEX',
    PARTY_MENU: 'PARTY_MENU',
    BAG_MENU: 'BAG_MENU',
    TRAINER_CARD: 'TRAINER_CARD',
    EVOLUTION: 'EVOLUTION'
  };

  // ==========================================================================
  // 2. RETRO SOUND SYNTHESIZER (Pure Web Audio API - Zero External Audio)
  // ==========================================================================
  class SoundEngine {
    constructor() {
      this.ctx = null;
      this.muted = false;
      this.currentBgm = null;
      this.bgmTimer = null;
    }

    init() {
      if (!this.ctx) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AudioContext();
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
    }

    toggleMute() {
      this.muted = !this.muted;
      if (this.muted && this.ctx) {
        if (this.bgmTimer) clearInterval(this.bgmTimer);
      }
      return this.muted;
    }

    playTone(freq, type = 'square', duration = 0.1, gainVal = 0.1, slideTo = null) {
      if (this.muted || !this.ctx) return;
      try {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        if (slideTo) {
          osc.frequency.exponentialRampToValueAtTime(Math.max(10, slideTo), this.ctx.currentTime + duration);
        }

        gain.gain.setValueAtTime(gainVal, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + duration);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start();
        osc.stop(this.ctx.currentTime + duration);
      } catch (e) {
        // audio context safety
      }
    }

    playNoise(duration = 0.15, gainVal = 0.1) {
      if (this.muted || !this.ctx) return;
      try {
        const bufferSize = this.ctx.sampleRate * duration;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          data[i] = Math.random() * 2 - 1;
        }

        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = 1000;

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(gainVal, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);

        noise.start();
      } catch (e) {}
    }

    // Sound FX Library
    sfxSelect() {
      this.playTone(660, 'square', 0.05, 0.08);
    }
    sfxConfirm() {
      this.playTone(880, 'square', 0.08, 0.1, 1320);
    }
    sfxCancel() {
      this.playTone(330, 'square', 0.08, 0.08, 220);
    }
    sfxBump() {
      this.playTone(120, 'triangle', 0.08, 0.12, 60);
    }
    sfxGrass() {
      this.playNoise(0.06, 0.05);
    }
    sfxLedge() {
      this.playTone(280, 'sine', 0.12, 0.1, 560);
    }
    sfxBattleStart() {
      this.playTone(200, 'sawtooth', 0.4, 0.15, 800);
      setTimeout(() => this.playNoise(0.3, 0.15), 150);
    }
    sfxHit() {
      this.playNoise(0.12, 0.2);
      this.playTone(180, 'square', 0.1, 0.15, 60);
    }
    sfxHitSuper() {
      this.playNoise(0.25, 0.25);
      this.playTone(300, 'sawtooth', 0.2, 0.2, 40);
    }
    sfxFaint() {
      this.playTone(400, 'square', 0.35, 0.15, 80);
    }
    sfxBallThrow() {
      this.playTone(300, 'sine', 0.15, 0.1, 600);
    }
    sfxBallShake() {
      this.playTone(450, 'triangle', 0.06, 0.12);
    }
    sfxBallCatch() {
      const notes = [523, 659, 784, 1046];
      notes.forEach((n, i) => {
        setTimeout(() => this.playTone(n, 'square', 0.15, 0.12), i * 110);
      });
    }
    sfxLevelUp() {
      const notes = [440, 554, 659, 880, 740, 880];
      notes.forEach((n, i) => {
        setTimeout(() => this.playTone(n, 'square', 0.12, 0.12), i * 100);
      });
    }
    sfxHeal() {
      // Classic 6-note Pokemon Center Recovery
      const notes = [523, 659, 784, 1046, 784, 1046];
      notes.forEach((n, i) => {
        setTimeout(() => this.playTone(n, 'square', 0.14, 0.14), i * 140);
      });
    }
    sfxCry(pitch = 500) {
      this.playTone(pitch, 'sawtooth', 0.18, 0.12, pitch * 1.5);
      setTimeout(() => this.playTone(pitch * 1.2, 'square', 0.15, 0.1, pitch * 0.7), 90);
    }

    // Background Music Synthesizer
    playBGM(track) {
      if (this.currentBgm === track) return;
      this.currentBgm = track;
      if (this.bgmTimer) clearInterval(this.bgmTimer);
      if (this.muted) return;

      let step = 0;
      if (track === 'littleroot') {
        const melody = [392, 440, 493, 587, 523, 440, 392, 329, 392, 440, 493, 392];
        const bass = [196, 196, 220, 220, 246, 246, 196, 196];
        this.bgmTimer = setInterval(() => {
          if (this.muted) return;
          const note = melody[step % melody.length];
          const bNote = bass[step % bass.length];
          this.playTone(note, 'triangle', 0.22, 0.05);
          if (step % 2 === 0) this.playTone(bNote, 'sine', 0.28, 0.04);
          step++;
        }, 280);
      } else if (track === 'route101') {
        const melody = [523, 587, 659, 698, 784, 659, 587, 523, 659, 784, 880, 784];
        this.bgmTimer = setInterval(() => {
          if (this.muted) return;
          const note = melody[step % melody.length];
          this.playTone(note, 'square', 0.14, 0.04);
          if (step % 2 === 1) this.playNoise(0.04, 0.02);
          step++;
        }, 220);
      } else if (track === 'battle') {
        const bassline = [110, 110, 130, 146, 110, 110, 164, 146];
        const lead = [440, 493, 523, 587, 659, 587, 523, 493];
        this.bgmTimer = setInterval(() => {
          if (this.muted) return;
          const b = bassline[step % bassline.length];
          const l = lead[(step >> 1) % lead.length];
          this.playTone(b, 'sawtooth', 0.1, 0.05);
          if (step % 2 === 0) this.playTone(l, 'square', 0.12, 0.04);
          if (step % 4 === 2) this.playNoise(0.05, 0.03);
          step++;
        }, 130);
      }
    }

    stopBGM() {
      this.currentBgm = null;
      if (this.bgmTimer) clearInterval(this.bgmTimer);
    }
  }

  const sound = new SoundEngine();

  // ==========================================================================
  // 3. POKÉMON DATABASE & TYPES
  // ==========================================================================
  const TYPES = {
    NORMAL: 'NORMAL',
    FIRE: 'FIRE',
    WATER: 'WATER',
    GRASS: 'GRASS',
    ELECTRIC: 'ELECTRIC',
    FLYING: 'FLYING',
    BUG: 'BUG',
    DARK: 'DARK',
    PSYCHIC: 'PSYCHIC',
    GROUND: 'GROUND',
    DRAGON: 'DRAGON'
  };

  const TYPE_COLORS = {
    NORMAL: '#A8A878',
    FIRE: '#F08030',
    WATER: '#6890F0',
    GRASS: '#78C850',
    ELECTRIC: '#F8D030',
    FLYING: '#A890F0',
    BUG: '#A8B820',
    DARK: '#705848',
    PSYCHIC: '#F85888',
    GROUND: '#E0C068',
    DRAGON: '#7038F8'
  };

  // Type Chart (Attacker -> Defender -> Multiplier)
  const TYPE_CHART = {
    FIRE: { GRASS: 2.0, WATER: 0.5, FIRE: 0.5, BUG: 2.0 },
    WATER: { FIRE: 2.0, GRASS: 0.5, WATER: 0.5, GROUND: 2.0 },
    GRASS: { WATER: 2.0, FIRE: 0.5, GRASS: 0.5, GROUND: 2.0, FLYING: 0.5, BUG: 0.5 },
    ELECTRIC: { WATER: 2.0, FLYING: 2.0, ELECTRIC: 0.5, GRASS: 0.5, GROUND: 0.0 },
    FLYING: { GRASS: 2.0, BUG: 2.0, ELECTRIC: 0.5 },
    BUG: { GRASS: 2.0, PSYCHIC: 2.0, DARK: 2.0, FIRE: 0.5, FLYING: 0.5 },
    DARK: { PSYCHIC: 2.0, DARK: 0.5 },
    PSYCHIC: { DARK: 0.0, PSYCHIC: 0.5 },
    GROUND: { FIRE: 2.0, ELECTRIC: 2.0, GRASS: 0.5, FLYING: 0.0 },
    DRAGON: { DRAGON: 2.0 },
    NORMAL: {}
  };

  function getTypeMultiplier(moveType, targetType) {
    if (TYPE_CHART[moveType] && TYPE_CHART[moveType][targetType] !== undefined) {
      return TYPE_CHART[moveType][targetType];
    }
    return 1.0;
  }

  // Master Move List
  const MOVES = {
    pound: { name: 'Pound', type: TYPES.NORMAL, power: 40, acc: 100, maxPp: 35 },
    scratch: { name: 'Scratch', type: TYPES.NORMAL, power: 40, acc: 100, maxPp: 35 },
    tackle: { name: 'Tackle', type: TYPES.NORMAL, power: 40, acc: 100, maxPp: 35 },
    quickAttack: { name: 'Quick Attack', type: TYPES.NORMAL, power: 40, acc: 100, maxPp: 30, priority: 1 },
    absorb: { name: 'Absorb', type: TYPES.GRASS, power: 20, acc: 100, maxPp: 25, drain: 0.5 },
    megaDrain: { name: 'Mega Drain', type: TYPES.GRASS, power: 40, acc: 100, maxPp: 15, drain: 0.5 },
    leafBlade: { name: 'Leaf Blade', type: TYPES.GRASS, power: 70, acc: 100, maxPp: 15 },
    ember: { name: 'Ember', type: TYPES.FIRE, power: 40, acc: 100, maxPp: 25 },
    flameWheel: { name: 'Flame Wheel', type: TYPES.FIRE, power: 60, acc: 100, maxPp: 20 },
    blazeKick: { name: 'Blaze Kick', type: TYPES.FIRE, power: 85, acc: 90, maxPp: 10 },
    waterGun: { name: 'Water Gun', type: TYPES.WATER, power: 40, acc: 100, maxPp: 25 },
    waterPulse: { name: 'Water Pulse', type: TYPES.WATER, power: 60, acc: 100, maxPp: 20 },
    mudShot: { name: 'Mud Shot', type: TYPES.GROUND, power: 55, acc: 95, maxPp: 15 },
    earthquake: { name: 'Earthquake', type: TYPES.GROUND, power: 100, acc: 100, maxPp: 10 },
    bite: { name: 'Bite', type: TYPES.DARK, power: 60, acc: 100, maxPp: 25 },
    thunderShock: { name: 'Thunder Shock', type: TYPES.ELECTRIC, power: 40, acc: 100, maxPp: 30 },
    spark: { name: 'Spark', type: TYPES.ELECTRIC, power: 65, acc: 100, maxPp: 20 },
    thunderbolt: { name: 'Thunderbolt', type: TYPES.ELECTRIC, power: 90, acc: 100, maxPp: 15 },
    peck: { name: 'Peck', type: TYPES.FLYING, power: 35, acc: 100, maxPp: 35 },
    wingAttack: { name: 'Wing Attack', type: TYPES.FLYING, power: 60, acc: 100, maxPp: 35 },
    confusion: { name: 'Confusion', type: TYPES.PSYCHIC, power: 50, acc: 100, maxPp: 25 },
    psychic: { name: 'Psychic', type: TYPES.PSYCHIC, power: 90, acc: 100, maxPp: 10 },
    bugBite: { name: 'Bug Bite', type: TYPES.BUG, power: 60, acc: 100, maxPp: 20 },
    dragonClaw: { name: 'Dragon Claw', type: TYPES.DRAGON, power: 80, acc: 100, maxPp: 15 },
    extremeSpeed: { name: 'Extreme Speed', type: TYPES.NORMAL, power: 80, acc: 100, maxPp: 5, priority: 2 },
    outrage: { name: 'Outrage', type: TYPES.DRAGON, power: 120, acc: 100, maxPp: 10 }
  };

  // Pokémon Species Database
  const POKEMON_DB = {
    // Starters & Evolutions
    252: {
      id: 252,
      name: 'Treecko',
      type: TYPES.GRASS,
      baseHp: 40,
      baseAtk: 45,
      baseDef: 35,
      baseSpd: 70,
      moves: ['pound', 'absorb', 'quickAttack'],
      evolvesAt: 16,
      evolvesTo: 253,
      desc: 'The Wood Gecko Pokémon. It makes its nest in a giant tree and fiercely defends its territory.'
    },
    253: {
      id: 253,
      name: 'Grovyle',
      type: TYPES.GRASS,
      baseHp: 50,
      baseAtk: 65,
      baseDef: 45,
      baseSpd: 95,
      moves: ['leafBlade', 'quickAttack', 'megaDrain', 'pound'],
      evolvesAt: 36,
      evolvesTo: 254,
      desc: 'Leaves growing out of this Pokémon\'s body are convenient for camouflaging it in foliage.'
    },
    254: {
      id: 254,
      name: 'Sceptile',
      type: TYPES.GRASS,
      baseHp: 70,
      baseAtk: 85,
      baseDef: 65,
      baseSpd: 120,
      moves: ['leafBlade', 'dragonClaw', 'megaDrain', 'quickAttack'],
      desc: 'The leaves growing on its forearms can slice down thick trees with unmatched agility.'
    },
    255: {
      id: 255,
      name: 'Torchic',
      type: TYPES.FIRE,
      baseHp: 45,
      baseAtk: 60,
      baseDef: 40,
      baseSpd: 45,
      moves: ['scratch', 'ember', 'quickAttack'],
      evolvesAt: 16,
      evolvesTo: 256,
      desc: 'The Chick Pokémon. A fire burns inside its belly, allowing it to spit fireballs of 1,800 degrees.'
    },
    256: {
      id: 256,
      name: 'Combusken',
      type: TYPES.FIRE,
      baseHp: 60,
      baseAtk: 85,
      baseDef: 60,
      baseSpd: 55,
      moves: ['flameWheel', 'quickAttack', 'ember', 'scratch'],
      evolvesAt: 36,
      evolvesTo: 257,
      desc: 'Its kicking power is devastating. It unleashes up to 10 kicks per second in battle.'
    },
    257: {
      id: 257,
      name: 'Blaziken',
      type: TYPES.FIRE,
      baseHp: 80,
      baseAtk: 120,
      baseDef: 70,
      baseSpd: 80,
      moves: ['blazeKick', 'flameWheel', 'quickAttack', 'scratch'],
      desc: 'Flames spout from its wrists during battle, scorching foes with powerful martial arts.'
    },
    258: {
      id: 258,
      name: 'Mudkip',
      type: TYPES.WATER,
      baseHp: 50,
      baseAtk: 70,
      baseDef: 50,
      baseSpd: 40,
      moves: ['tackle', 'waterGun', 'mudShot'],
      evolvesAt: 16,
      evolvesTo: 259,
      desc: 'The Mud Fish Pokémon. The fin on Mudkip’s head acts as highly sensitive radar to detect currents.'
    },
    259: {
      id: 259,
      name: 'Marshtomp',
      type: TYPES.WATER,
      baseHp: 70,
      baseAtk: 85,
      baseDef: 70,
      baseSpd: 50,
      moves: ['waterPulse', 'mudShot', 'tackle', 'waterGun'],
      evolvesAt: 36,
      evolvesTo: 260,
      desc: 'Its hind legs are sturdy. It walks effortlessly through the stickiest mud in wetlands.'
    },
    260: {
      id: 260,
      name: 'Swampert',
      type: TYPES.WATER,
      baseHp: 100,
      baseAtk: 110,
      baseDef: 90,
      baseSpd: 60,
      moves: ['earthquake', 'waterPulse', 'mudShot', 'tackle'],
      desc: 'Its arms are rock-hard. With one swing, it can batter down a boulder into pebble pieces.'
    },

    // Wild Route 101 & Woods
    261: {
      id: 261,
      name: 'Poochyena',
      type: TYPES.DARK,
      baseHp: 35,
      baseAtk: 55,
      baseDef: 35,
      baseSpd: 35,
      moves: ['tackle', 'bite'],
      desc: 'It has a tenacious nature. Once it spots prey, it chases tirelessly until the target is exhausted.'
    },
    263: {
      id: 263,
      name: 'Zigzagoon',
      type: TYPES.NORMAL,
      baseHp: 38,
      baseAtk: 30,
      baseDef: 41,
      baseSpd: 60,
      moves: ['tackle', 'quickAttack'],
      desc: 'A Pokémon with abundant curiosity. It shows interest in everything, walking in zigzags.'
    },
    265: {
      id: 265,
      name: 'Wurmple',
      type: TYPES.BUG,
      baseHp: 45,
      baseAtk: 45,
      baseDef: 35,
      baseSpd: 20,
      moves: ['tackle', 'bugBite'],
      desc: 'Using the spikes on its rear end, Wurmple peels the bark off trees and feeds on sap.'
    },
    276: {
      id: 276,
      name: 'Taillow',
      type: TYPES.FLYING,
      baseHp: 40,
      baseAtk: 55,
      baseDef: 30,
      baseSpd: 85,
      moves: ['peck', 'quickAttack', 'wingAttack'],
      desc: 'Small but gutsy. It will boldly stand up to foes far larger than itself without backing down.'
    },
    280: {
      id: 280,
      name: 'Ralts',
      type: TYPES.PSYCHIC,
      baseHp: 28,
      baseAtk: 25,
      baseDef: 25,
      baseSpd: 40,
      moves: ['confusion', 'psychic'],
      desc: 'Ralts senses the emotions of people using the horns on its head. It warms up to cheerful trainers.'
    },
    25: {
      id: 25,
      name: 'Pikachu',
      type: TYPES.ELECTRIC,
      baseHp: 35,
      baseAtk: 55,
      baseDef: 40,
      baseSpd: 90,
      moves: ['thunderShock', 'quickAttack', 'spark', 'thunderbolt'],
      desc: 'When several of these Pokémon gather, their electricity can build and cause lightning storms.'
    },

    // Legendary Emerald Boss
    384: {
      id: 384,
      name: 'Rayquaza',
      type: TYPES.DRAGON,
      baseHp: 105,
      baseAtk: 150,
      baseDef: 90,
      baseSpd: 95,
      moves: ['dragonClaw', 'extremeSpeed', 'outrage'],
      desc: 'The Sky High Pokémon. It lived in the ozone layer for hundreds of millions of years, descending to quell Kyogre and Groudon.'
    }
  };

  // Sprite Loader with Caching
  const spriteCache = {};
  function getSprite(id, isBack = false) {
    const key = `${id}_${isBack ? 'back' : 'front'}`;
    if (spriteCache[key]) return spriteCache[key];

    const img = new Image();
    // Primary: Animated Showdown GIF
    const url = isBack
      ? `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/showdown/back/${id}.gif`
      : `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/showdown/${id}.gif`;

    img.crossOrigin = 'anonymous';
    img.src = url;

    // Fallback: Emerald Gen-3 PNG
    img.onerror = () => {
      const fallbackUrl = isBack
        ? `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-iii/emerald/back/${id}.png`
        : `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-iii/emerald/${id}.png`;
      img.src = fallbackUrl;
    };

    spriteCache[key] = img;
    return img;
  }

  // Preload core sprites
  Object.keys(POKEMON_DB).forEach(id => {
    getSprite(id, false);
    getSprite(id, true);
  });

  // Factory function to create a Pokémon instance
  function createPokemon(speciesId, level = 5) {
    const spec = POKEMON_DB[speciesId];
    if (!spec) return null;

    const maxHp = Math.floor(((spec.baseHp * 2 * level) / 100) + level + 10);
    const atk = Math.floor(((spec.baseAtk * 2 * level) / 100) + 5);
    const def = Math.floor(((spec.baseDef * 2 * level) / 100) + 5);
    const spd = Math.floor(((spec.baseSpd * 2 * level) / 100) + 5);

    const moves = spec.moves.map(mKey => {
      const mData = MOVES[mKey];
      return {
        key: mKey,
        name: mData.name,
        type: mData.type,
        power: mData.power,
        acc: mData.acc,
        curPp: mData.maxPp,
        maxPp: mData.maxPp,
        drain: mData.drain || 0,
        priority: mData.priority || 0
      };
    });

    return {
      speciesId: spec.id,
      name: spec.name,
      type: spec.type,
      level: level,
      curHp: maxHp,
      maxHp: maxHp,
      atk: atk,
      def: def,
      spd: spd,
      exp: level * level * level,
      nextExp: (level + 1) * (level + 1) * (level + 1),
      moves: moves,
      gender: Math.random() > 0.5 ? '♂' : '♀'
    };
  }

  // ==========================================================================
  // 4. MAP TILES & WORLD ARCHITECTURE
  // ==========================================================================
  const TILES = {
    GRASS: 0,
    TALL_GRASS: 1,
    PATH_DIRT: 2,
    PATH_STONE: 3,
    TREE: 4,
    WATER: 5,
    FENCE: 6,
    FLOWER_RED: 7,
    FLOWER_YELLOW: 8,
    HOUSE_ROOF_RED: 9,
    HOUSE_WALL: 10,
    HOUSE_DOOR: 11,
    LAB_ROOF_BLUE: 12,
    LAB_WALL: 13,
    LAB_DOOR: 14,
    POKECENTER_ROOF: 15,
    POKECENTER_WALL: 16,
    POKECENTER_DOOR: 17,
    POKEMART_ROOF: 18,
    POKEMART_WALL: 19,
    POKEMART_DOOR: 20,
    SIGN: 21,
    LEDGE_DOWN: 22,
    ALTAR: 23,
    ITEM_BALL: 24
  };

  const SOLID_TILES = new Set([
    TILES.TREE,
    TILES.WATER,
    TILES.FENCE,
    TILES.HOUSE_ROOF_RED,
    TILES.HOUSE_WALL,
    TILES.LAB_ROOF_BLUE,
    TILES.LAB_WALL,
    TILES.POKECENTER_ROOF,
    TILES.POKECENTER_WALL,
    TILES.POKEMART_ROOF,
    TILES.POKEMART_WALL,
    TILES.SIGN,
    TILES.ALTAR
  ]);

  // Procedural Map Generation for authentic Hoenn feel
  function createWorldMap() {
    const map = [];
    for (let r = 0; r < MAP_ROWS; r++) {
      const row = [];
      for (let c = 0; c < MAP_COLS; c++) {
        // Border trees
        if (r === 0 || r === MAP_ROWS - 1 || c === 0 || c === MAP_COLS - 1) {
          row.push(TILES.TREE);
        } else {
          row.push(TILES.GRASS);
        }
      }
      map.push(row);
    }

    // Zone 1: Littleroot Town (Rows 24 to 36)
    for (let r = 24; r < 36; r++) {
      for (let c = 6; c < 30; c++) {
        map[r][c] = TILES.GRASS;
      }
    }

    // Town paths
    for (let r = 25; r < 35; r++) {
      map[r][17] = TILES.PATH_STONE;
      map[r][18] = TILES.PATH_STONE;
    }
    for (let c = 8; c < 28; c++) {
      map[30][c] = TILES.PATH_STONE;
    }

    // Player House (Left, rows 26-28, cols 8-12)
    map[26][9] = TILES.HOUSE_ROOF_RED; map[26][10] = TILES.HOUSE_ROOF_RED; map[26][11] = TILES.HOUSE_ROOF_RED;
    map[27][9] = TILES.HOUSE_WALL;     map[27][10] = TILES.HOUSE_WALL;     map[27][11] = TILES.HOUSE_WALL;
    map[28][9] = TILES.HOUSE_WALL;     map[28][10] = TILES.HOUSE_DOOR;     map[28][11] = TILES.HOUSE_WALL;

    // Birch's Pokémon Lab (Right, rows 25-28, cols 22-26)
    map[25][22] = TILES.LAB_ROOF_BLUE; map[25][23] = TILES.LAB_ROOF_BLUE; map[25][24] = TILES.LAB_ROOF_BLUE; map[25][25] = TILES.LAB_ROOF_BLUE;
    map[26][22] = TILES.LAB_ROOF_BLUE; map[26][23] = TILES.LAB_ROOF_BLUE; map[26][24] = TILES.LAB_ROOF_BLUE; map[26][25] = TILES.LAB_ROOF_BLUE;
    map[27][22] = TILES.LAB_WALL;      map[27][23] = TILES.LAB_WALL;      map[27][24] = TILES.LAB_WALL;      map[27][25] = TILES.LAB_WALL;
    map[28][22] = TILES.LAB_WALL;      map[28][23] = TILES.LAB_DOOR;      map[28][24] = TILES.LAB_DOOR;      map[28][25] = TILES.LAB_WALL;

    // Town Signs & Flowers
    map[29][13] = TILES.SIGN; // Player house sign
    map[29][21] = TILES.SIGN; // Birch Lab sign
    map[32][16] = TILES.FLOWER_RED; map[32][19] = TILES.FLOWER_RED;
    map[33][16] = TILES.FLOWER_YELLOW; map[33][19] = TILES.FLOWER_YELLOW;

    // Fences
    for (let c = 7; c <= 13; c++) map[34][c] = TILES.FENCE;
    for (let c = 21; c <= 27; c++) map[34][c] = TILES.FENCE;

    // Zone 2: Route 101 (Rows 12 to 23)
    // Winding dirt path
    for (let r = 12; r < 25; r++) {
      map[r][17] = TILES.PATH_DIRT;
      map[r][18] = TILES.PATH_DIRT;
    }
    // S-curve in the path
    for (let c = 13; c <= 18; c++) map[18][c] = TILES.PATH_DIRT;
    for (let r = 15; r <= 18; r++) map[r][13] = TILES.PATH_DIRT;

    // Tall grass patches on Route 101
    const tallGrassCoords = [
      // Left patch
      [19, 9], [19, 10], [19, 11], [19, 12],
      [20, 9], [20, 10], [20, 11], [20, 12],
      [21, 9], [21, 10], [21, 11], [21, 12],
      [22, 10], [22, 11],
      // Right patch
      [19, 21], [19, 22], [19, 23], [19, 24],
      [20, 21], [20, 22], [20, 23], [20, 24],
      [21, 21], [21, 22], [21, 23], [21, 24],
      // Upper patch
      [14, 14], [14, 15], [14, 19], [14, 20],
      [15, 14], [15, 15], [15, 19], [15, 20],
      [16, 14], [16, 15], [16, 19], [16, 20]
    ];
    tallGrassCoords.forEach(([r, c]) => {
      map[r][c] = TILES.TALL_GRASS;
    });

    // Ledges to jump down
    map[17][21] = TILES.LEDGE_DOWN;
    map[17][22] = TILES.LEDGE_DOWN;
    map[17][23] = TILES.LEDGE_DOWN;

    // Item ball on Route 101
    map[20][25] = TILES.ITEM_BALL;

    // Route 101 Sign
    map[23][15] = TILES.SIGN;

    // Zone 3: Oldale Town (Rows 5 to 11)
    for (let r = 5; r <= 11; r++) {
      for (let c = 7; c <= 29; c++) {
        map[r][c] = TILES.GRASS;
      }
    }
    // Town square paved
    for (let r = 8; r <= 11; r++) {
      map[r][17] = TILES.PATH_STONE;
      map[r][18] = TILES.PATH_STONE;
    }
    for (let c = 10; c <= 25; c++) {
      map[9][c] = TILES.PATH_STONE;
    }

    // Pokémon Center (Left, rows 6-8, cols 10-13)
    map[6][10] = TILES.POKECENTER_ROOF; map[6][11] = TILES.POKECENTER_ROOF; map[6][12] = TILES.POKECENTER_ROOF; map[6][13] = TILES.POKECENTER_ROOF;
    map[7][10] = TILES.POKECENTER_WALL; map[7][11] = TILES.POKECENTER_WALL; map[7][12] = TILES.POKECENTER_WALL; map[7][13] = TILES.POKECENTER_WALL;
    map[8][10] = TILES.POKECENTER_WALL; map[8][11] = TILES.POKECENTER_DOOR; map[8][12] = TILES.POKECENTER_DOOR; map[8][13] = TILES.POKECENTER_WALL;

    // Pokémart (Right, rows 6-8, cols 22-25)
    map[6][22] = TILES.POKEMART_ROOF; map[6][23] = TILES.POKEMART_ROOF; map[6][24] = TILES.POKEMART_ROOF; map[6][25] = TILES.POKEMART_ROOF;
    map[7][22] = TILES.POKEMART_WALL; map[7][23] = TILES.POKEMART_WALL; map[7][24] = TILES.POKEMART_WALL; map[7][25] = TILES.POKEMART_WALL;
    map[8][22] = TILES.POKEMART_WALL; map[8][23] = TILES.POKEMART_DOOR; map[8][24] = TILES.POKEMART_DOOR; map[8][25] = TILES.POKEMART_WALL;

    // Small pond in Oldale Town
    map[6][16] = TILES.WATER; map[6][17] = TILES.WATER; map[6][18] = TILES.WATER;
    map[7][16] = TILES.WATER; map[7][17] = TILES.WATER; map[7][18] = TILES.WATER;

    // Zone 4: Sky Altar (Rows 1 to 4, top center)
    for (let c = 15; c <= 20; c++) {
      map[4][c] = TILES.PATH_STONE;
    }
    map[2][17] = TILES.ALTAR;
    map[2][18] = TILES.ALTAR;

    return map;
  }

  // ==========================================================================
  // 5. GAME ENGINE CORE STATE
  // ==========================================================================
  class Game {
    constructor() {
      this.canvas = document.getElementById('gameCanvas');
      this.ctx = this.canvas.getContext('2d');
      this.ctx.imageSmoothingEnabled = false;

      this.state = STATES.TITLE;
      this.worldMap = createWorldMap();

      // Camera
      this.camera = { x: 0, y: 0 };

      // Player
      this.player = {
        gridX: 10,
        gridY: 29, // In front of house in Littleroot
        x: 10 * TILE_SIZE,
        y: 29 * TILE_SIZE,
        targetX: 10 * TILE_SIZE,
        targetY: 29 * TILE_SIZE,
        dir: 'down', // 'down', 'up', 'left', 'right'
        moving: false,
        running: false,
        animFrame: 0,
        animTimer: 0,
        inGrass: false,
        hopping: false,
        hopTimer: 0,
        party: [],
        bag: {
          pokeballs: 10,
          greatballs: 3,
          potions: 5,
          superpotions: 2
        },
        money: 3000,
        name: 'BRENDAN',
        seenPokemon: new Set(),
        caughtPokemon: new Set(),
        hasStarter: false
      };

      // Input keys
      this.keys = {};
      this.keyPresses = {};

      // Dialogue System
      this.dialogue = {
        lines: [],
        curLine: 0,
        charIndex: 0,
        timer: 0,
        onComplete: null,
        speaker: ''
      };

      // Battle System State
      this.battle = null;

      // Start Menu State
      this.menuIndex = 0;
      this.menuItems = ['POKéDEX', 'POKéMON', 'BAG', 'TRAINER', 'SAVE', 'EXIT'];

      // Starter Selection State
      this.starterIndex = 0; // 0: Treecko, 1: Torchic, 2: Mudkip

      // NPCs
      this.npcs = [
        {
          id: 'mom',
          name: 'MOM',
          gridX: 12,
          gridY: 29,
          dir: 'down',
          dialogue: [
            "MOM: Welcome home, dear!",
            "I see you're starting your journey across Hoenn!",
            "Here, let me heal your Pokémon rest up!",
            "Take care and don't forget to hold SHIFT to run!"
          ],
          action: () => {
            sound.sfxHeal();
            this.healParty();
          }
        },
        {
          id: 'birch',
          name: 'PROF. BIRCH',
          gridX: 23,
          gridY: 29,
          dir: 'down',
          dialogue: [
            "PROF. BIRCH: Hello there, young Trainer!",
            "In my briefcase are three rare starter Pokémon!",
            "Choose wisely between TREECKO, TORCHIC, or MUDKIP!"
          ],
          action: () => {
            if (!this.player.hasStarter) {
              this.state = STATES.STARTER_SELECT;
            }
          }
        },
        {
          id: 'youngster',
          name: 'YOUNGSTER JOEY',
          gridX: 19,
          gridY: 17,
          dir: 'left',
          dialogue: [
            "JOEY: The tall grass on Route 101 is packed with wild Pokémon!",
            "Weaken them first before throwing a Pokéball!",
            "And check out the Pokémon Center in Oldale Town to heal!"
          ]
        },
        {
          id: 'nurse_joy',
          name: 'NURSE JOY',
          gridX: 11,
          gridY: 9,
          dir: 'down',
          dialogue: [
            "NURSE JOY: Welcome to the Pokémon Center!",
            "We restore your tired Pokémon to full health.",
            "Please rest your team for a moment..."
          ],
          action: () => {
            sound.sfxHeal();
            this.healParty();
          }
        },
        {
          id: 'mart_clerk',
          name: 'CLERK',
          gridX: 23,
          gridY: 9,
          dir: 'down',
          dialogue: [
            "CLERK: Welcome to the Oldale Town Pokémart!",
            "Here, take these free sample supplies for your adventure!"
          ],
          action: () => {
            this.player.bag.pokeballs += 5;
            this.player.bag.potions += 3;
            sound.sfxConfirm();
          }
        },
        {
          id: 'rayquaza_npc',
          name: 'RAYQUAZA',
          gridX: 17,
          gridY: 3,
          dir: 'down',
          isBoss: true,
          dialogue: [
            "GYAAAROOOOOSH!",
            "The ancient Dragon of Sky Pillar unleashes a deafening roar!"
          ],
          action: () => {
            this.startBattle(384, 50); // Legendary Level 50 Boss
          }
        }
      ];

      // Sign posts
      this.signs = {
        '13,29': "BRENDAN'S HOUSE\n'Home sweet home in Littleroot Town.'",
        '21,29': "PROF. BIRCH'S POKéMON LAB\n'Study of Pokémon Habitats and Distribution.'",
        '15,23': "ROUTE 101\n'Danger! Wild Pokémon inhabit the tall grass!'",
        '17,8': "OLDALE TOWN\n'Where things start off scarce and flourish.'"
      };

      // Dust and Grass Particles
      this.particles = [];

      this.initInput();
      this.loadGame();

      // Start loop
      this.lastTime = performance.now();
      requestAnimationFrame(this.loop.bind(this));
    }

    // ========================================================================
    // 6. INPUT HANDLING
    // ========================================================================
    initInput() {
      window.addEventListener('keydown', e => {
        sound.init(); // User interaction unlocks Web Audio
        this.keys[e.code] = true;
        this.keyPresses[e.code] = true;

        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
          e.preventDefault();
        }

        // Quick mute toggle
        if (e.code === 'KeyM') {
          this.toggleSound();
        }
      });

      window.addEventListener('keyup', e => {
        this.keys[e.code] = false;
      });

      // On-screen D-Pad and Action buttons
      const registerButton = (id, keyCode) => {
        const btn = document.getElementById(id);
        if (!btn) return;
        const press = (ev) => {
          ev.preventDefault();
          sound.init();
          this.keys[keyCode] = true;
          this.keyPresses[keyCode] = true;
          btn.classList.add('active');
        };
        const release = (ev) => {
          ev.preventDefault();
          this.keys[keyCode] = false;
          btn.classList.remove('active');
        };

        btn.addEventListener('mousedown', press);
        btn.addEventListener('mouseup', release);
        btn.addEventListener('mouseleave', release);
        btn.addEventListener('touchstart', press, { passive: false });
        btn.addEventListener('touchend', release, { passive: false });
      };

      registerButton('btn-up', 'ArrowUp');
      registerButton('btn-down', 'ArrowDown');
      registerButton('btn-left', 'ArrowLeft');
      registerButton('btn-right', 'ArrowRight');
      registerButton('btn-a', 'KeyZ');
      registerButton('btn-b', 'KeyX');
      registerButton('btn-start', 'KeyC');
      registerButton('btn-select', 'KeyX');

      // Top bar actions
      document.getElementById('btn-sound').addEventListener('click', () => this.toggleSound());
      document.getElementById('btn-fullscreen').addEventListener('click', () => this.toggleFullscreen());
      document.getElementById('btn-save-quick').addEventListener('click', () => {
        this.saveGame();
        sound.sfxConfirm();
      });

      const modal = document.getElementById('help-modal');
      document.getElementById('btn-help').addEventListener('click', () => {
        modal.classList.remove('hidden');
      });
      document.getElementById('modal-close').addEventListener('click', () => {
        modal.classList.add('hidden');
      });
    }

    isPressed(keyCode) {
      if (this.keyPresses[keyCode]) {
        this.keyPresses[keyCode] = false;
        return true;
      }
      return false;
    }

    clearKeyPresses() {
      this.keyPresses = {};
    }

    toggleSound() {
      const isMuted = sound.toggleMute();
      const btn = document.getElementById('btn-sound');
      btn.querySelector('.icon').textContent = isMuted ? '🔇' : '🔊';
      btn.querySelector('.label').textContent = isMuted ? 'Muted' : 'Sound';
    }

    toggleFullscreen() {
      document.body.classList.toggle('fullscreen-mode');
    }

    // ========================================================================
    // 7. SAVE & LOAD SYSTEM
    // ========================================================================
    saveGame() {
      const led = document.getElementById('power-led');
      if (led) {
        led.classList.add('saving');
        setTimeout(() => led.classList.remove('saving'), 800);
      }

      const data = {
        player: {
          gridX: this.player.gridX,
          gridY: this.player.gridY,
          dir: this.player.dir,
          party: this.player.party,
          bag: this.player.bag,
          money: this.player.money,
          name: this.player.name,
          seen: Array.from(this.player.seenPokemon),
          caught: Array.from(this.player.caughtPokemon),
          hasStarter: this.player.hasStarter
        }
      };

      try {
        localStorage.setItem(SAVE_KEY, JSON.stringify(data));
      } catch (e) {
        console.error('Save failed:', e);
      }
    }

    loadGame() {
      try {
        const raw = localStorage.getItem(SAVE_KEY);
        if (!raw) return false;
        const data = JSON.parse(raw);
        if (data && data.player) {
          const p = data.player;
          this.player.gridX = p.gridX || 10;
          this.player.gridY = p.gridY || 29;
          this.player.x = this.player.gridX * TILE_SIZE;
          this.player.y = this.player.gridY * TILE_SIZE;
          this.player.targetX = this.player.x;
          this.player.targetY = this.player.y;
          this.player.dir = p.dir || 'down';
          this.player.party = p.party || [];
          this.player.bag = p.bag || this.player.bag;
          this.player.money = p.money || 3000;
          this.player.seenPokemon = new Set(p.seen || []);
          this.player.caughtPokemon = new Set(p.caught || []);
          this.player.hasStarter = p.hasStarter || false;
          return true;
        }
      } catch (e) {
        console.error('Load failed:', e);
      }
      return false;
    }

    healParty() {
      this.player.party.forEach(pk => {
        pk.curHp = pk.maxHp;
        pk.moves.forEach(m => m.curPp = m.maxPp);
      });
    }

    // ========================================================================
    // 8. MAIN ENGINE LOOP
    // ========================================================================
    loop(timestamp) {
      const dt = (timestamp - this.lastTime) / 1000;
      this.lastTime = timestamp;

      this.update(dt);
      this.render();

      this.clearKeyPresses();
      requestAnimationFrame(this.loop.bind(this));
    }

    // ========================================================================
    // 9. UPDATE LOGIC
    // ========================================================================
    update(dt) {
      switch (this.state) {
        case STATES.TITLE:
          this.updateTitle(dt);
          break;
        case STATES.STARTER_SELECT:
          this.updateStarterSelect(dt);
          break;
        case STATES.OVERWORLD:
          this.updateOverworld(dt);
          break;
        case STATES.DIALOGUE:
          this.updateDialogue(dt);
          break;
        case STATES.BATTLE:
          this.updateBattle(dt);
          break;
        case STATES.MENU:
          this.updateMenu(dt);
          break;
        case STATES.POKEDEX:
          this.updatePokedex(dt);
          break;
        case STATES.PARTY_MENU:
          this.updatePartyMenu(dt);
          break;
        case STATES.BAG_MENU:
          this.updateBagMenu(dt);
          break;
        case STATES.TRAINER_CARD:
          this.updateTrainerCard(dt);
          break;
        case STATES.EVOLUTION:
          this.updateEvolution(dt);
          break;
      }

      // Update particles
      for (let i = this.particles.length - 1; i >= 0; i--) {
        const p = this.particles[i];
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.life -= dt;
        if (p.life <= 0) this.particles.splice(i, 1);
      }
    }

    // Title Screen
    updateTitle(dt) {
      if (this.isPressed('KeyZ') || this.isPressed('Space') || this.isPressed('Enter')) {
        sound.sfxConfirm();
        if (!this.player.hasStarter) {
          this.state = STATES.STARTER_SELECT;
        } else {
          this.state = STATES.OVERWORLD;
          sound.playBGM('littleroot');
        }
      }
    }

    // Starter Selection
    updateStarterSelect(dt) {
      if (this.isPressed('ArrowLeft') || this.isPressed('KeyA')) {
        this.starterIndex = (this.starterIndex + 2) % 3;
        sound.sfxSelect();
      }
      if (this.isPressed('ArrowRight') || this.isPressed('KeyD')) {
        this.starterIndex = (this.starterIndex + 1) % 3;
        sound.sfxSelect();
      }

      if (this.isPressed('KeyZ') || this.isPressed('Space') || this.isPressed('Enter')) {
        sound.sfxConfirm();
        const starterIds = [252, 255, 258]; // Treecko, Torchic, Mudkip
        const chosenId = starterIds[this.starterIndex];
        const starter = createPokemon(chosenId, 5);

        this.player.party = [starter];
        this.player.hasStarter = true;
        this.player.seenPokemon.add(chosenId);
        this.player.caughtPokemon.add(chosenId);

        this.saveGame();
        sound.sfxCry(400);

        this.startDialogue([
          `PROF. BIRCH: Outstanding! You chose ${starter.name}!`,
          `Treat ${starter.name} with care and friendship, and it will be your loyal partner!`,
          "Now, begin your adventure! Route 101 awaits to the north!"
        ], () => {
          this.state = STATES.OVERWORLD;
          sound.playBGM('littleroot');
        });
      }
    }

    // Overworld
    updateOverworld(dt) {
      const p = this.player;

      // Menu toggle
      if (this.isPressed('KeyC') || this.isPressed('Escape')) {
        sound.sfxSelect();
        this.menuIndex = 0;
        this.state = STATES.MENU;
        return;
      }

      // Check Running Shoes (Shift or B button held)
      p.running = (this.keys['ShiftLeft'] || this.keys['ShiftRight'] || this.keys['KeyX']);
      const moveSpeed = p.running ? 160 : 96;

      // Move execution
      if (p.moving) {
        const dx = p.targetX - p.x;
        const dy = p.targetY - p.y;
        const dist = Math.hypot(dx, dy);
        const step = moveSpeed * dt;

        p.animTimer += dt * (p.running ? 12 : 8);
        if (p.animTimer > 1) {
          p.animTimer = 0;
          p.animFrame = (p.animFrame + 1) % 4;
        }

        // Dust particle if running
        if (p.running && Math.random() < 0.25) {
          this.particles.push({
            x: p.x + 16,
            y: p.y + 28,
            vx: (Math.random() - 0.5) * 20,
            vy: -15,
            life: 0.25,
            color: '#e2d5b8',
            size: 3
          });
        }

        if (dist <= step) {
          p.x = p.targetX;
          p.y = p.targetY;
          p.gridX = Math.round(p.x / TILE_SIZE);
          p.gridY = Math.round(p.y / TILE_SIZE);
          p.moving = false;
          p.animFrame = 0;

          // Check tile events
          this.onStepTile();
        } else {
          p.x += (dx / dist) * step;
          p.y += (dy / dist) * step;
        }
      } else {
        // Idle - Check directional inputs
        let moved = false;
        if (this.keys['ArrowUp'] || this.keys['KeyW']) {
          this.attemptMove('up');
          moved = true;
        } else if (this.keys['ArrowDown'] || this.keys['KeyS']) {
          this.attemptMove('down');
          moved = true;
        } else if (this.keys['ArrowLeft'] || this.keys['KeyA']) {
          this.attemptMove('left');
          moved = true;
        } else if (this.keys['ArrowRight'] || this.keys['KeyD']) {
          this.attemptMove('right');
          moved = true;
        }

        // Interaction (A Button)
        if (!moved && (this.isPressed('KeyZ') || this.isPressed('Space') || this.isPressed('Enter'))) {
          this.interact();
        }
      }

      // Update camera centered on player
      this.camera.x = Math.max(0, Math.min(MAP_COLS * TILE_SIZE - CANVAS_W, p.x + 16 - CANVAS_W / 2));
      this.camera.y = Math.max(0, Math.min(MAP_ROWS * TILE_SIZE - CANVAS_H, p.y + 16 - CANVAS_H / 2));

      // Zone music
      if (p.gridY < 12) {
        sound.playBGM('littleroot'); // Oldale Town
      } else if (p.gridY <= 24) {
        sound.playBGM('route101'); // Route 101
      } else {
        sound.playBGM('littleroot'); // Littleroot Town
      }
    }

    attemptMove(dir) {
      const p = this.player;
      p.dir = dir;

      let nextX = p.gridX;
      let nextY = p.gridY;

      if (dir === 'up') nextY--;
      if (dir === 'down') nextY++;
      if (dir === 'left') nextX--;
      if (dir === 'right') nextX++;

      // Check bounds
      if (nextX < 0 || nextX >= MAP_COLS || nextY < 0 || nextY >= MAP_ROWS) {
        sound.sfxBump();
        return;
      }

      const targetTile = this.worldMap[nextY][nextX];

      // Check Ledge jump (down only)
      if (targetTile === TILES.LEDGE_DOWN && dir === 'down') {
        sound.sfxLedge();
        p.moving = true;
        p.hopping = true;
        p.targetX = nextX * TILE_SIZE;
        p.targetY = (nextY + 1) * TILE_SIZE; // Jump 2 tiles down
        return;
      }

      // Check solid tiles
      if (SOLID_TILES.has(targetTile)) {
        sound.sfxBump();
        return;
      }

      // Check NPCs
      const npcHit = this.npcs.find(n => n.gridX === nextX && n.gridY === nextY);
      if (npcHit) {
        sound.sfxBump();
        return;
      }

      // Valid move
      p.moving = true;
      p.targetX = nextX * TILE_SIZE;
      p.targetY = nextY * TILE_SIZE;
    }

    onStepTile() {
      const p = this.player;
      const tile = this.worldMap[p.gridY][p.gridX];

      p.inGrass = (tile === TILES.TALL_GRASS);

      // Grass rustle effect
      if (p.inGrass) {
        sound.sfxGrass();
        for (let i = 0; i < 4; i++) {
          this.particles.push({
            x: p.x + 8 + Math.random() * 16,
            y: p.y + 16 + Math.random() * 10,
            vx: (Math.random() - 0.5) * 30,
            vy: -20 - Math.random() * 20,
            life: 0.3,
            color: '#4ade80',
            size: 2
          });
        }

        // Wild encounter check (12% chance per grass step)
        if (Math.random() < 0.12 && p.party.length > 0) {
          this.triggerWildBattle();
        }
      }

      // Ground Item pickup
      if (tile === TILES.ITEM_BALL) {
        this.worldMap[p.gridY][p.gridX] = TILES.GRASS;
        sound.sfxBallCatch();
        p.bag.potions += 2;
        p.bag.greatballs += 1;
        this.startDialogue([
          "Found 2x POTIONS and 1x GREAT BALL on the ground!",
          "Put items away in the BAG."
        ]);
      }
    }

    interact() {
      const p = this.player;
      let targetX = p.gridX;
      let targetY = p.gridY;

      if (p.dir === 'up') targetY--;
      if (p.dir === 'down') targetY++;
      if (p.dir === 'left') targetX--;
      if (p.dir === 'right') targetX++;

      // Check NPCs
      const npc = this.npcs.find(n => n.gridX === targetX && n.gridY === targetY);
      if (npc) {
        sound.sfxSelect();
        // Face player
        if (p.dir === 'up') npc.dir = 'down';
        if (p.dir === 'down') npc.dir = 'up';
        if (p.dir === 'left') npc.dir = 'right';
        if (p.dir === 'right') npc.dir = 'left';

        this.startDialogue(npc.dialogue, () => {
          if (npc.action) npc.action();
        });
        return;
      }

      // Check Signs
      const signKey = `${targetX},${targetY}`;
      if (this.signs[signKey]) {
        sound.sfxSelect();
        this.startDialogue(this.signs[signKey].split('\n'));
        return;
      }

      // Check Starter Bag if in Birch Lab door
      if (targetX === 23 && targetY === 28 && !p.hasStarter) {
        sound.sfxSelect();
        this.state = STATES.STARTER_SELECT;
        return;
      }
    }

    triggerWildBattle() {
      // Possible Wild Pokemon
      const pool = [
        { id: 261, minLv: 2, maxLv: 4 }, // Poochyena
        { id: 263, minLv: 2, maxLv: 4 }, // Zigzagoon
        { id: 265, minLv: 3, maxLv: 5 }, // Wurmple
        { id: 276, minLv: 3, maxLv: 5 }, // Taillow
        { id: 280, minLv: 3, maxLv: 4 }, // Ralts (rare)
        { id: 25, minLv: 5, maxLv: 6 }   // Pikachu (rare)
      ];

      const r = Math.random();
      let chosen;
      if (r < 0.35) chosen = pool[0];
      else if (r < 0.65) chosen = pool[1];
      else if (r < 0.85) chosen = pool[2];
      else if (r < 0.93) chosen = pool[3];
      else if (r < 0.98) chosen = pool[4];
      else chosen = pool[5];

      const lv = Math.floor(Math.random() * (chosen.maxLv - chosen.minLv + 1)) + chosen.minLv;
      this.startBattle(chosen.id, lv);
    }

    // ========================================================================
    // 10. DIALOGUE SYSTEM
    // ========================================================================
    startDialogue(lines, onComplete = null) {
      this.dialogue.lines = Array.isArray(lines) ? lines : [lines];
      this.dialogue.curLine = 0;
      this.dialogue.charIndex = 0;
      this.dialogue.timer = 0;
      this.dialogue.onComplete = onComplete;
      this.state = STATES.DIALOGUE;
    }

    updateDialogue(dt) {
      const d = this.dialogue;
      const fullText = d.lines[d.curLine] || '';

      // Typewriter advance
      if (d.charIndex < fullText.length) {
        d.timer += dt;
        if (d.timer > 0.025) {
          d.timer = 0;
          d.charIndex++;
          if (d.charIndex % 3 === 0) sound.sfxSelect();
        }

        // Fast forward with A
        if (this.isPressed('KeyZ') || this.isPressed('Space') || this.isPressed('Enter')) {
          d.charIndex = fullText.length;
        }
      } else {
        // Line finished, waiting for A
        if (this.isPressed('KeyZ') || this.isPressed('Space') || this.isPressed('Enter')) {
          sound.sfxConfirm();
          d.curLine++;
          if (d.curLine < d.lines.length) {
            d.charIndex = 0;
            d.timer = 0;
          } else {
            // Dialogue completed
            this.state = STATES.OVERWORLD;
            if (d.onComplete) d.onComplete();
          }
        }
      }
    }

    // ========================================================================
    // 11. BATTLE SYSTEM
    // ========================================================================
    startBattle(wildSpeciesId, wildLevel) {
      sound.stopBGM();
      sound.sfxBattleStart();

      const wildPk = createPokemon(wildSpeciesId, wildLevel);
      const activePk = this.player.party.find(p => p.curHp > 0) || this.player.party[0];

      this.player.seenPokemon.add(wildSpeciesId);

      this.battle = {
        wild: wildPk,
        playerPk: activePk,
        phase: 'TRANSITION', // TRANSITION, INTRO_TEXT, MENU_MAIN, MENU_FIGHT, MENU_BAG, MENU_PARTY, TURN_EXECUTE, CATCH_ANIM, VICTORY, FAINT
        subIndex: 0,
        text: `Wild ${wildPk.name} appeared!`,
        textProgress: 0,
        transitionTimer: 0.8,
        shakeTimer: 0,
        animTarget: null,
        animType: null,
        caught: false,
        ballWobbles: 0,
        ballWobbleTimer: 0
      };

      this.state = STATES.BATTLE;
      setTimeout(() => sound.playBGM('battle'), 700);
    }

    updateBattle(dt) {
      const b = this.battle;
      if (!b) return;

      if (b.shakeTimer > 0) b.shakeTimer -= dt;

      switch (b.phase) {
        case 'TRANSITION':
          b.transitionTimer -= dt;
          if (b.transitionTimer <= 0) {
            b.phase = 'INTRO_TEXT';
            b.text = `Wild ${b.wild.name} appeared!\nGo! ${b.playerPk.name}!`;
          }
          break;

        case 'INTRO_TEXT':
          if (this.isPressed('KeyZ') || this.isPressed('Space') || this.isPressed('Enter')) {
            sound.sfxConfirm();
            b.phase = 'MENU_MAIN';
            b.subIndex = 0;
          }
          break;

        case 'MENU_MAIN':
          // 0: FIGHT, 1: BAG, 2: POKÉMON, 3: RUN
          if (this.isPressed('ArrowUp') || this.isPressed('KeyW')) {
            if (b.subIndex >= 2) b.subIndex -= 2;
            sound.sfxSelect();
          }
          if (this.isPressed('ArrowDown') || this.isPressed('KeyS')) {
            if (b.subIndex <= 1) b.subIndex += 2;
            sound.sfxSelect();
          }
          if (this.isPressed('ArrowLeft') || this.isPressed('KeyA')) {
            if (b.subIndex % 2 === 1) b.subIndex -= 1;
            sound.sfxSelect();
          }
          if (this.isPressed('ArrowRight') || this.isPressed('KeyD')) {
            if (b.subIndex % 2 === 0) b.subIndex += 1;
            sound.sfxSelect();
          }

          if (this.isPressed('KeyZ') || this.isPressed('Space') || this.isPressed('Enter')) {
            sound.sfxConfirm();
            if (b.subIndex === 0) {
              b.phase = 'MENU_FIGHT';
              b.subIndex = 0;
            } else if (b.subIndex === 1) {
              b.phase = 'MENU_BAG';
              b.subIndex = 0;
            } else if (b.subIndex === 2) {
              b.phase = 'MENU_PARTY';
              b.subIndex = 0;
            } else if (b.subIndex === 3) {
              // RUN
              sound.sfxSelect();
              b.text = 'Got away safely!';
              b.phase = 'END_TEXT';
              b.onEnd = () => this.endBattle();
            }
          }
          break;

        case 'MENU_FIGHT':
          // 4 moves
          const moves = b.playerPk.moves;
          if (this.isPressed('ArrowUp') || this.isPressed('KeyW')) {
            if (b.subIndex >= 2) b.subIndex -= 2;
            sound.sfxSelect();
          }
          if (this.isPressed('ArrowDown') || this.isPressed('KeyS')) {
            if (b.subIndex <= 1 && b.subIndex + 2 < moves.length) b.subIndex += 2;
            sound.sfxSelect();
          }
          if (this.isPressed('ArrowLeft') || this.isPressed('KeyA')) {
            if (b.subIndex % 2 === 1) b.subIndex -= 1;
            sound.sfxSelect();
          }
          if (this.isPressed('ArrowRight') || this.isPressed('KeyD')) {
            if (b.subIndex % 2 === 0 && b.subIndex + 1 < moves.length) b.subIndex += 1;
            sound.sfxSelect();
          }
          if (this.isPressed('KeyX') || this.isPressed('Escape')) {
            sound.sfxCancel();
            b.phase = 'MENU_MAIN';
            b.subIndex = 0;
            return;
          }

          if (this.isPressed('KeyZ') || this.isPressed('Space') || this.isPressed('Enter')) {
            const chosenMove = moves[b.subIndex];
            if (chosenMove.curPp <= 0) {
              sound.sfxCancel();
              b.text = 'No PP left for this move!';
              return;
            }
            sound.sfxConfirm();
            this.executeBattleTurn(chosenMove);
          }
          break;

        case 'MENU_BAG':
          const bagItems = [
            { name: 'POKé BALL', count: this.player.bag.pokeballs, action: () => this.useBall('pokeballs', 1.0) },
            { name: 'GREAT BALL', count: this.player.bag.greatballs, action: () => this.useBall('greatballs', 1.5) },
            { name: 'POTION', count: this.player.bag.potions, action: () => this.usePotion(20) },
            { name: 'SUPER POTION', count: this.player.bag.superpotions, action: () => this.usePotion(50) }
          ];

          if (this.isPressed('ArrowUp') || this.isPressed('KeyW')) {
            b.subIndex = (b.subIndex + bagItems.length - 1) % bagItems.length;
            sound.sfxSelect();
          }
          if (this.isPressed('ArrowDown') || this.isPressed('KeyS')) {
            b.subIndex = (b.subIndex + 1) % bagItems.length;
            sound.sfxSelect();
          }
          if (this.isPressed('KeyX') || this.isPressed('Escape')) {
            sound.sfxCancel();
            b.phase = 'MENU_MAIN';
            b.subIndex = 1;
            return;
          }

          if (this.isPressed('KeyZ') || this.isPressed('Space') || this.isPressed('Enter')) {
            const item = bagItems[b.subIndex];
            if (item.count <= 0) {
              sound.sfxCancel();
              b.text = `You don't have any ${item.name}!`;
              return;
            }
            sound.sfxConfirm();
            item.action();
          }
          break;

        case 'MENU_PARTY':
          const party = this.player.party;
          if (this.isPressed('ArrowUp') || this.isPressed('KeyW')) {
            b.subIndex = (b.subIndex + party.length - 1) % party.length;
            sound.sfxSelect();
          }
          if (this.isPressed('ArrowDown') || this.isPressed('KeyS')) {
            b.subIndex = (b.subIndex + 1) % party.length;
            sound.sfxSelect();
          }
          if (this.isPressed('KeyX') || this.isPressed('Escape')) {
            sound.sfxCancel();
            b.phase = 'MENU_MAIN';
            b.subIndex = 2;
            return;
          }

          if (this.isPressed('KeyZ') || this.isPressed('Space') || this.isPressed('Enter')) {
            const chosen = party[b.subIndex];
            if (chosen === b.playerPk) {
              sound.sfxCancel();
              b.text = `${chosen.name} is already in battle!`;
              return;
            }
            if (chosen.curHp <= 0) {
              sound.sfxCancel();
              b.text = `${chosen.name} has no will to fight!`;
              return;
            }
            sound.sfxConfirm();
            b.playerPk = chosen;
            b.text = `Go! ${chosen.name}!`;
            b.phase = 'ENEMY_ATTACK';
          }
          break;

        case 'CATCH_ANIM':
          b.ballWobbleTimer += dt;
          if (b.ballWobbleTimer > 0.6) {
            b.ballWobbleTimer = 0;
            b.ballWobbles++;
            sound.sfxBallShake();

            if (b.ballWobbles >= 3) {
              if (b.caught) {
                // Success!
                sound.sfxBallCatch();
                b.text = `Gotcha! ${b.wild.name} was caught!`;
                this.player.caughtPokemon.add(b.wild.speciesId);
                if (this.player.party.length < 6) {
                  this.player.party.push(b.wild);
                }
                this.saveGame();
                b.phase = 'END_TEXT';
                b.onEnd = () => this.endBattle();
              } else {
                // Broke free
                sound.sfxHit();
                b.text = `Aww! It broke free!`;
                b.phase = 'ENEMY_ATTACK';
              }
            }
          }
          break;

        case 'ENEMY_ATTACK':
          if (this.isPressed('KeyZ') || this.isPressed('Space') || this.isPressed('Enter')) {
            sound.sfxConfirm();
            this.executeEnemyAttack();
          }
          break;

        case 'END_TEXT':
          if (this.isPressed('KeyZ') || this.isPressed('Space') || this.isPressed('Enter')) {
            sound.sfxConfirm();
            if (b.onEnd) b.onEnd();
          }
          break;
      }
    }

    useBall(ballType, multiplier) {
      const b = this.battle;
      this.player.bag[ballType]--;

      sound.sfxBallThrow();
      b.phase = 'CATCH_ANIM';
      b.ballWobbles = 0;
      b.ballWobbleTimer = 0;
      b.text = `BRENDAN used ${ballType === 'greatballs' ? 'GREAT BALL' : 'POKé BALL'}!`;

      // Catch Rate Formula
      const hpPercent = b.wild.curHp / b.wild.maxHp;
      const catchRate = Math.min(0.95, (1.0 - hpPercent * 0.7) * multiplier * (b.wild.id === 384 ? 0.2 : 0.65));
      b.caught = Math.random() < catchRate;
    }

    usePotion(healAmount) {
      const b = this.battle;
      if (healAmount === 20) this.player.bag.potions--;
      else this.player.bag.superpotions--;

      sound.sfxHeal();
      b.playerPk.curHp = Math.min(b.playerPk.maxHp, b.playerPk.curHp + healAmount);
      b.text = `Used POTION on ${b.playerPk.name}!\nRestored ${healAmount} HP!`;
      b.phase = 'ENEMY_ATTACK';
    }

    executeBattleTurn(playerMove) {
      const b = this.battle;
      playerMove.curPp--;

      // Priority and Speed check
      const playerPriority = playerMove.priority || 0;
      const playerFirst = playerPriority > 0 || (b.playerPk.spd >= b.wild.spd);

      if (playerFirst) {
        this.performAttack(b.playerPk, b.wild, playerMove, () => {
          if (b.wild.curHp <= 0) {
            this.onWildFaint();
          } else {
            b.phase = 'ENEMY_ATTACK';
            b.text = `${b.wild.name} is preparing to strike!`;
          }
        });
      } else {
        const enemyMove = b.wild.moves[Math.floor(Math.random() * b.wild.moves.length)];
        this.performAttack(b.wild, b.playerPk, enemyMove, () => {
          if (b.playerPk.curHp <= 0) {
            this.onPlayerFaint();
          } else {
            this.performAttack(b.playerPk, b.wild, playerMove, () => {
              if (b.wild.curHp <= 0) {
                this.onWildFaint();
              } else {
                b.phase = 'MENU_MAIN';
                b.subIndex = 0;
              }
            });
          }
        });
      }
    }

    executeEnemyAttack() {
      const b = this.battle;
      const enemyMove = b.wild.moves[Math.floor(Math.random() * b.wild.moves.length)];
      this.performAttack(b.wild, b.playerPk, enemyMove, () => {
        if (b.playerPk.curHp <= 0) {
          this.onPlayerFaint();
        } else {
          b.phase = 'MENU_MAIN';
          b.subIndex = 0;
        }
      });
    }

    performAttack(attacker, defender, move, onDone) {
      const b = this.battle;
      b.shakeTimer = 0.3;
      b.animTarget = defender;

      // Damage formula
      const mult = getTypeMultiplier(move.type, defender.type);
      const isCrit = Math.random() < 0.08;
      const stab = (move.type === attacker.type) ? 1.5 : 1.0;

      const baseDmg = Math.floor((((2 * attacker.level / 5 + 2) * move.power * attacker.atk / defender.def) / 50) + 2);
      const totalDmg = Math.max(1, Math.floor(baseDmg * mult * stab * (isCrit ? 1.5 : 1.0)));

      defender.curHp = Math.max(0, defender.curHp - totalDmg);

      // Drain move (e.g. Absorb)
      if (move.drain && attacker.curHp < attacker.maxHp) {
        attacker.curHp = Math.min(attacker.maxHp, attacker.curHp + Math.floor(totalDmg * move.drain));
      }

      if (mult > 1.0) sound.sfxHitSuper();
      else sound.sfxHit();

      let effMsg = '';
      if (mult > 1.0) effMsg = "\nIt's super effective!";
      else if (mult < 1.0 && mult > 0) effMsg = "\nIt's not very effective...";
      else if (mult === 0) effMsg = "\nIt had no effect!";
      if (isCrit) effMsg += ' Critical hit!';

      b.text = `${attacker.name} used ${move.name}!${effMsg}`;
      b.phase = 'END_TEXT';
      b.onEnd = onDone;
    }

    onWildFaint() {
      const b = this.battle;
      sound.sfxFaint();

      const expGain = Math.floor((b.wild.baseHp || 40) * b.wild.level / 5);
      b.playerPk.exp += expGain;
      this.player.money += b.wild.level * 45;

      b.text = `Wild ${b.wild.name} fainted!\n${b.playerPk.name} gained ${expGain} EXP!`;

      // Check Level Up
      if (b.playerPk.exp >= b.playerPk.nextExp) {
        b.playerPk.level++;
        b.playerPk.nextExp = (b.playerPk.level + 1) * (b.playerPk.level + 1) * (b.playerPk.level + 1);

        const spec = POKEMON_DB[b.playerPk.speciesId];
        b.playerPk.maxHp = Math.floor(((spec.baseHp * 2 * b.playerPk.level) / 100) + b.playerPk.level + 10);
        b.playerPk.curHp = Math.min(b.playerPk.maxHp, b.playerPk.curHp + 5);
        b.playerPk.atk = Math.floor(((spec.baseAtk * 2 * b.playerPk.level) / 100) + 5);
        b.playerPk.def = Math.floor(((spec.baseDef * 2 * b.playerPk.level) / 100) + 5);
        b.playerPk.spd = Math.floor(((spec.baseSpd * 2 * b.playerPk.level) / 100) + 5);

        sound.sfxLevelUp();
        b.text += `\n${b.playerPk.name} grew to Level ${b.playerPk.level}!`;

        // Check Evolution
        if (spec.evolvesAt && b.playerPk.level >= spec.evolvesAt) {
          b.phase = 'END_TEXT';
          b.onEnd = () => this.startEvolution(b.playerPk, spec.evolvesTo);
          return;
        }
      }

      this.saveGame();
      b.phase = 'END_TEXT';
      b.onEnd = () => this.endBattle();
    }

    onPlayerFaint() {
      const b = this.battle;
      sound.sfxFaint();
      b.text = `${b.playerPk.name} fainted!`;

      const nextAlive = this.player.party.find(p => p.curHp > 0);
      if (nextAlive) {
        b.phase = 'END_TEXT';
        b.onEnd = () => {
          b.playerPk = nextAlive;
          b.text = `Go! ${nextAlive.name}!`;
          b.phase = 'MENU_MAIN';
          b.subIndex = 0;
        };
      } else {
        // Blackout!
        b.text = "BRENDAN is out of usable Pokémon!\nBRENDAN blacked out!";
        b.phase = 'END_TEXT';
        b.onEnd = () => {
          this.healParty();
          this.player.x = 10 * TILE_SIZE;
          this.player.y = 29 * TILE_SIZE;
          this.player.gridX = 10;
          this.player.gridY = 29;
          this.player.targetX = this.player.x;
          this.player.targetY = this.player.y;
          this.endBattle();
        };
      }
    }

    endBattle() {
      this.battle = null;
      this.state = STATES.OVERWORLD;
      sound.playBGM(this.player.gridY <= 24 ? 'route101' : 'littleroot');
    }

    // ========================================================================
    // 12. EVOLUTION SYSTEM
    // ========================================================================
    startEvolution(pokemon, newSpeciesId) {
      sound.stopBGM();
      this.state = STATES.EVOLUTION;
      this.evolution = {
        pk: pokemon,
        targetSpec: POKEMON_DB[newSpeciesId],
        phase: 'INTRO',
        timer: 0,
        flash: false
      };
    }

    updateEvolution(dt) {
      const ev = this.evolution;
      ev.timer += dt;

      if (ev.phase === 'INTRO') {
        if (ev.timer > 1.5) {
          ev.phase = 'TRANSFORM';
          ev.timer = 0;
        }
      } else if (ev.phase === 'TRANSFORM') {
        ev.flash = (Math.floor(ev.timer * 8) % 2 === 0);
        if (ev.timer > 3.0) {
          // Complete Evolution
          sound.sfxLevelUp();
          ev.pk.speciesId = ev.targetSpec.id;
          ev.pk.name = ev.targetSpec.name;
          ev.pk.type = ev.targetSpec.type;

          this.player.seenPokemon.add(ev.targetSpec.id);
          this.player.caughtPokemon.add(ev.targetSpec.id);
          this.saveGame();

          ev.phase = 'FINISHED';
        }
      } else if (ev.phase === 'FINISHED') {
        if (this.isPressed('KeyZ') || this.isPressed('Space') || this.isPressed('Enter')) {
          sound.sfxConfirm();
          this.endBattle();
        }
      }
    }

    // ========================================================================
    // 13. START MENU LOGIC
    // ========================================================================
    updateMenu(dt) {
      if (this.isPressed('ArrowUp') || this.isPressed('KeyW')) {
        this.menuIndex = (this.menuIndex + this.menuItems.length - 1) % this.menuItems.length;
        sound.sfxSelect();
      }
      if (this.isPressed('ArrowDown') || this.isPressed('KeyS')) {
        this.menuIndex = (this.menuIndex + 1) % this.menuItems.length;
        sound.sfxSelect();
      }
      if (this.isPressed('KeyX') || this.isPressed('Escape')) {
        sound.sfxCancel();
        this.state = STATES.OVERWORLD;
        return;
      }

      if (this.isPressed('KeyZ') || this.isPressed('Space') || this.isPressed('Enter')) {
        sound.sfxConfirm();
        const selected = this.menuItems[this.menuIndex];
        if (selected === 'POKéDEX') this.state = STATES.POKEDEX;
        else if (selected === 'POKéMON') this.state = STATES.PARTY_MENU;
        else if (selected === 'BAG') this.state = STATES.BAG_MENU;
        else if (selected === 'TRAINER') this.state = STATES.TRAINER_CARD;
        else if (selected === 'SAVE') {
          this.saveGame();
          this.startDialogue([
            "SAVING... DON'T TURN OFF THE POWER.",
            "BRENDAN saved the game!"
          ]);
        } else if (selected === 'EXIT') {
          this.state = STATES.OVERWORLD;
        }
      }
    }

    updatePokedex(dt) {
      if (this.isPressed('KeyX') || this.isPressed('Escape')) {
        sound.sfxCancel();
        this.state = STATES.MENU;
      }
    }

    updatePartyMenu(dt) {
      if (this.isPressed('KeyX') || this.isPressed('Escape')) {
        sound.sfxCancel();
        this.state = STATES.MENU;
      }
    }

    updateBagMenu(dt) {
      if (this.isPressed('KeyX') || this.isPressed('Escape')) {
        sound.sfxCancel();
        this.state = STATES.MENU;
      }
    }

    updateTrainerCard(dt) {
      if (this.isPressed('KeyX') || this.isPressed('Escape')) {
        sound.sfxCancel();
        this.state = STATES.MENU;
      }
    }

    // ========================================================================
    // 14. RENDERING PIPELINE
    // ========================================================================
    render() {
      this.ctx.fillStyle = '#000';
      this.ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

      switch (this.state) {
        case STATES.TITLE:
          this.renderTitle();
          break;
        case STATES.STARTER_SELECT:
          this.renderStarterSelect();
          break;
        case STATES.OVERWORLD:
        case STATES.MENU:
        case STATES.POKEDEX:
        case STATES.PARTY_MENU:
        case STATES.BAG_MENU:
        case STATES.TRAINER_CARD:
          this.renderOverworld();
          if (this.state === STATES.MENU) this.renderStartMenu();
          if (this.state === STATES.POKEDEX) this.renderPokedex();
          if (this.state === STATES.PARTY_MENU) this.renderPartyMenu();
          if (this.state === STATES.BAG_MENU) this.renderBagMenu();
          if (this.state === STATES.TRAINER_CARD) this.renderTrainerCard();
          break;
        case STATES.DIALOGUE:
          this.renderOverworld();
          this.renderDialogueBox();
          break;
        case STATES.BATTLE:
          this.renderBattle();
          break;
        case STATES.EVOLUTION:
          this.renderEvolution();
          break;
      }
    }

    // ------------------------------------------------------------------------
    // Title Screen Render
    // ------------------------------------------------------------------------
    renderTitle() {
      const ctx = this.ctx;
      // Emerald gradient background
      const grad = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
      grad.addColorStop(0, '#042217');
      grad.addColorStop(0.5, '#064e3b');
      grad.addColorStop(1, '#021810');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

      // Rayquaza Silhouette / Sprite in background
      const ray = getSprite(384, false);
      if (ray && ray.complete && ray.naturalWidth > 0) {
        ctx.save();
        ctx.globalAlpha = 0.25;
        ctx.drawImage(ray, CANVAS_W / 2 - 120, 30, 240, 240);
        ctx.restore();
      }

      // Title Banner
      ctx.fillStyle = '#ffffff';
      ctx.font = '24px "Press Start 2P", monospace';
      ctx.textAlign = 'center';
      ctx.shadowColor = '#000';
      ctx.shadowOffsetX = 3;
      ctx.shadowOffsetY = 3;
      ctx.fillText('POKéMON', CANVAS_W / 2, 85);

      ctx.fillStyle = '#34d399';
      ctx.font = '28px "Press Start 2P", monospace';
      ctx.shadowColor = '#10b981';
      ctx.shadowBlur = 10;
      ctx.fillText('EMERALD', CANVAS_W / 2, 125);
      ctx.shadowBlur = 0;

      ctx.fillStyle = '#94a3b8';
      ctx.font = '10px "Press Start 2P", monospace';
      ctx.fillText('VERSION', CANVAS_W / 2, 150);

      // Starters preview
      const starters = [252, 255, 258];
      starters.forEach((id, idx) => {
        const spr = getSprite(id, false);
        if (spr && spr.complete) {
          ctx.drawImage(spr, 100 + idx * 110, 160, 64, 64);
        }
      });

      // Press Start Blinking
      if (Math.floor(Date.now() / 500) % 2 === 0) {
        ctx.fillStyle = '#fef08a';
        ctx.font = '12px "Press Start 2P", monospace';
        ctx.fillText('PRESS START / ENTER', CANVAS_W / 2, 265);
      }

      ctx.fillStyle = '#64748b';
      ctx.font = '8px "Press Start 2P", monospace';
      ctx.fillText('© 2004-2026 GAME FREAK / NINTENDO', CANVAS_W / 2, 300);
      ctx.textAlign = 'left';
    }

    // ------------------------------------------------------------------------
    // Starter Selection Render
    // ------------------------------------------------------------------------
    renderStarterSelect() {
      const ctx = this.ctx;
      ctx.fillStyle = '#064e3b';
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

      // Briefcase / Table
      ctx.fillStyle = '#78350f';
      ctx.fillRect(40, 40, CANVAS_W - 80, CANVAS_H - 80);
      ctx.fillStyle = '#92400e';
      ctx.fillRect(46, 46, CANVAS_W - 92, CANVAS_H - 92);

      ctx.fillStyle = '#fef3c7';
      ctx.font = '12px "Press Start 2P", monospace';
      ctx.textAlign = 'center';
      ctx.fillText("CHOOSE YOUR PARTNER POKéMON!", CANVAS_W / 2, 75);

      const starters = [
        { id: 252, name: 'TREECKO', type: 'GRASS' },
        { id: 255, name: 'TORCHIC', type: 'FIRE' },
        { id: 258, name: 'MUDKIP', type: 'WATER' }
      ];

      starters.forEach((pk, i) => {
        const x = 90 + i * 110;
        const y = 110;
        const selected = (i === this.starterIndex);

        // Highlight box
        if (selected) {
          ctx.fillStyle = 'rgba(52, 211, 153, 0.4)';
          ctx.fillRect(x - 12, y - 10, 88, 120);
          ctx.strokeStyle = '#34d399';
          ctx.lineWidth = 3;
          ctx.strokeRect(x - 12, y - 10, 88, 120);
        }

        // Pokéball or Sprite
        const spr = getSprite(pk.id, false);
        if (spr && spr.complete) {
          ctx.drawImage(spr, x, y, 64, 64);
        }

        ctx.fillStyle = selected ? '#ffffff' : '#cbd5e1';
        ctx.font = '9px "Press Start 2P", monospace';
        ctx.fillText(pk.name, x + 32, y + 80);

        ctx.fillStyle = TYPE_COLORS[pk.type] || '#fff';
        ctx.fillText(`[${pk.type}]`, x + 32, y + 96);
      });

      // Description at bottom
      const current = starters[this.starterIndex];
      const desc = POKEMON_DB[current.id].desc;
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(50, 230, CANVAS_W - 100, 45);
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 1;
      ctx.strokeRect(50, 230, CANVAS_W - 100, 45);

      ctx.fillStyle = '#ffffff';
      ctx.font = '7px "Press Start 2P", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(desc.slice(0, 50), CANVAS_W / 2, 248);
      ctx.fillText(desc.slice(50, 110), CANVAS_W / 2, 262);

      ctx.textAlign = 'left';
    }

    // ------------------------------------------------------------------------
    // Overworld Render
    // ------------------------------------------------------------------------
    renderOverworld() {
      const ctx = this.ctx;
      const camX = this.camera.x;
      const camY = this.camera.y;

      const startCol = Math.floor(camX / TILE_SIZE);
      const endCol = Math.min(MAP_COLS, Math.ceil((camX + CANVAS_W) / TILE_SIZE));
      const startRow = Math.floor(camY / TILE_SIZE);
      const endRow = Math.min(MAP_ROWS, Math.ceil((camY + CANVAS_H) / TILE_SIZE));

      // Draw Tiles
      for (let r = startRow; r < endRow; r++) {
        for (let c = startCol; c < endCol; c++) {
          const tile = this.worldMap[r][c];
          const screenX = c * TILE_SIZE - camX;
          const screenY = r * TILE_SIZE - camY;
          this.drawTile(tile, screenX, screenY, r, c);
        }
      }

      // Draw NPCs
      this.npcs.forEach(npc => {
        const screenX = npc.gridX * TILE_SIZE - camX;
        const screenY = npc.gridY * TILE_SIZE - camY;
        if (screenX >= -TILE_SIZE && screenX <= CANVAS_W && screenY >= -TILE_SIZE && screenY <= CANVAS_H) {
          this.drawNPC(npc, screenX, screenY);
        }
      });

      // Draw Player
      const playerScreenX = this.player.x - camX;
      const playerScreenY = this.player.y - camY;
      this.drawPlayer(playerScreenX, playerScreenY);

      // Draw Grass Overlay on top of player's feet if in grass
      if (this.player.inGrass) {
        ctx.fillStyle = '#22c55e';
        ctx.fillRect(playerScreenX + 4, playerScreenY + 22, 24, 6);
        ctx.fillStyle = '#16a34a';
        ctx.fillRect(playerScreenX + 6, playerScreenY + 20, 4, 8);
        ctx.fillRect(playerScreenX + 16, playerScreenY + 20, 4, 8);
      }

      // Draw Particles
      this.particles.forEach(p => {
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x - camX, p.y - camY, p.size, p.size);
      });
    }

    // Individual Tile Painter
    drawTile(tile, x, y, r, c) {
      const ctx = this.ctx;
      switch (tile) {
        case TILES.GRASS:
          ctx.fillStyle = '#4ade80'; // Emerald bright lawn
          ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
          // Subtle grass blade details
          if ((r + c) % 3 === 0) {
            ctx.fillStyle = '#22c55e';
            ctx.fillRect(x + 6, y + 8, 2, 4);
            ctx.fillRect(x + 20, y + 18, 2, 4);
          }
          break;

        case TILES.TALL_GRASS:
          ctx.fillStyle = '#22c55e';
          ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
          // Darker green stalks
          ctx.fillStyle = '#15803d';
          ctx.fillRect(x + 4, y + 4, 6, 24);
          ctx.fillRect(x + 14, y + 2, 6, 26);
          ctx.fillRect(x + 22, y + 6, 6, 22);
          // Grass tips highlight
          ctx.fillStyle = '#86efac';
          ctx.fillRect(x + 5, y + 3, 4, 3);
          ctx.fillRect(x + 15, y + 1, 4, 3);
          ctx.fillRect(x + 23, y + 5, 4, 3);
          break;

        case TILES.PATH_DIRT:
          ctx.fillStyle = '#fde047'; // Sand / dirt route
          ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
          ctx.fillStyle = '#ca8a04';
          ctx.fillRect(x + 6, y + 10, 3, 2);
          ctx.fillRect(x + 20, y + 22, 2, 2);
          break;

        case TILES.PATH_STONE:
          ctx.fillStyle = '#94a3b8'; // Cobblestone town path
          ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
          ctx.fillStyle = '#64748b';
          ctx.strokeRect(x + 1, y + 1, TILE_SIZE - 2, TILE_SIZE - 2);
          break;

        case TILES.TREE:
          // Forest backdrop
          ctx.fillStyle = '#166534';
          ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
          // Rounded emerald tree crown
          ctx.fillStyle = '#15803d';
          ctx.beginPath();
          ctx.arc(x + 16, y + 14, 13, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#22c55e';
          ctx.beginPath();
          ctx.arc(x + 14, y + 12, 9, 0, Math.PI * 2);
          ctx.fill();
          break;

        case TILES.WATER:
          const wave = Math.sin(Date.now() / 300 + (r + c)) * 2;
          ctx.fillStyle = '#38bdf8';
          ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
          ctx.fillStyle = '#bae6fd';
          ctx.fillRect(x + 4 + wave, y + 8, 12, 2);
          ctx.fillRect(x + 14 - wave, y + 20, 10, 2);
          break;

        case TILES.FENCE:
          ctx.fillStyle = '#4ade80';
          ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
          ctx.fillStyle = '#f8fafc';
          ctx.fillRect(x + 2, y + 8, TILE_SIZE - 4, 6);
          ctx.fillRect(x + 2, y + 18, TILE_SIZE - 4, 6);
          ctx.fillRect(x + 6, y + 4, 4, 24);
          ctx.fillRect(x + 22, y + 4, 4, 24);
          break;

        case TILES.FLOWER_RED:
        case TILES.FLOWER_YELLOW:
          ctx.fillStyle = '#4ade80';
          ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
          ctx.fillStyle = (tile === TILES.FLOWER_RED) ? '#ef4444' : '#eab308';
          ctx.beginPath();
          ctx.arc(x + 10, y + 14, 4, 0, Math.PI * 2);
          ctx.arc(x + 22, y + 20, 4, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#fff';
          ctx.fillRect(x + 9, y + 13, 2, 2);
          ctx.fillRect(x + 21, y + 19, 2, 2);
          break;

        case TILES.HOUSE_ROOF_RED:
          ctx.fillStyle = '#b91c1c';
          ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
          ctx.fillStyle = '#ef4444';
          ctx.fillRect(x + 2, y + 2, TILE_SIZE - 4, 4);
          break;

        case TILES.HOUSE_WALL:
          ctx.fillStyle = '#e2e8f0';
          ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
          ctx.fillStyle = '#94a3b8';
          ctx.fillRect(x + 6, y + 8, 8, 8); // Window
          break;

        case TILES.HOUSE_DOOR:
          ctx.fillStyle = '#e2e8f0';
          ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
          ctx.fillStyle = '#78350f';
          ctx.fillRect(x + 6, y + 6, 20, 26);
          ctx.fillStyle = '#fde047';
          ctx.fillRect(x + 22, y + 18, 2, 4); // Handle
          break;

        case TILES.LAB_ROOF_BLUE:
          ctx.fillStyle = '#1d4ed8';
          ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
          ctx.fillStyle = '#60a5fa';
          ctx.fillRect(x + 2, y + 2, TILE_SIZE - 4, 4);
          break;

        case TILES.LAB_WALL:
          ctx.fillStyle = '#f1f5f9';
          ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
          ctx.fillStyle = '#38bdf8';
          ctx.fillRect(x + 4, y + 6, 24, 10); // Wide research window
          break;

        case TILES.LAB_DOOR:
          ctx.fillStyle = '#f1f5f9';
          ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
          ctx.fillStyle = '#0284c7';
          ctx.fillRect(x + 4, y + 6, 24, 26);
          break;

        case TILES.POKECENTER_ROOF:
          ctx.fillStyle = '#dc2626';
          ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
          ctx.fillStyle = '#fca5a5';
          ctx.fillRect(x + 2, y + 2, TILE_SIZE - 4, 4);
          break;

        case TILES.POKECENTER_WALL:
          ctx.fillStyle = '#fff';
          ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
          // Pokéball emblem
          ctx.fillStyle = '#ef4444';
          ctx.beginPath();
          ctx.arc(x + 16, y + 14, 6, 0, Math.PI * 2);
          ctx.fill();
          break;

        case TILES.POKECENTER_DOOR:
          ctx.fillStyle = '#fff';
          ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
          ctx.fillStyle = '#ef4444';
          ctx.fillRect(x + 4, y + 6, 24, 26);
          ctx.fillStyle = '#fff';
          ctx.fillRect(x + 10, y + 10, 12, 12);
          break;

        case TILES.POKEMART_ROOF:
          ctx.fillStyle = '#2563eb';
          ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
          ctx.fillStyle = '#93c5fd';
          ctx.fillRect(x + 2, y + 2, TILE_SIZE - 4, 4);
          break;

        case TILES.POKEMART_WALL:
          ctx.fillStyle = '#fff';
          ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
          ctx.fillStyle = '#2563eb';
          ctx.fillRect(x + 6, y + 8, 20, 8);
          break;

        case TILES.POKEMART_DOOR:
          ctx.fillStyle = '#fff';
          ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
          ctx.fillStyle = '#2563eb';
          ctx.fillRect(x + 4, y + 6, 24, 26);
          break;

        case TILES.SIGN:
          ctx.fillStyle = '#4ade80';
          ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
          ctx.fillStyle = '#78350f';
          ctx.fillRect(x + 14, y + 14, 4, 18);
          ctx.fillStyle = '#d97706';
          ctx.fillRect(x + 6, y + 6, 20, 14);
          ctx.fillStyle = '#fff';
          ctx.fillRect(x + 8, y + 8, 16, 2);
          break;

        case TILES.LEDGE_DOWN:
          ctx.fillStyle = '#ca8a04';
          ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
          ctx.fillStyle = '#a16207';
          ctx.fillRect(x, y + 20, TILE_SIZE, 12);
          // Down arrow indicators
          ctx.fillStyle = '#fef08a';
          ctx.fillRect(x + 14, y + 24, 4, 4);
          break;

        case TILES.ALTAR:
          ctx.fillStyle = '#064e3b';
          ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
          ctx.fillStyle = '#10b981';
          ctx.fillRect(x + 2, y + 2, TILE_SIZE - 4, TILE_SIZE - 4);
          ctx.fillStyle = '#34d399';
          ctx.fillRect(x + 6, y + 6, TILE_SIZE - 12, TILE_SIZE - 12);
          break;

        case TILES.ITEM_BALL:
          ctx.fillStyle = '#4ade80';
          ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
          // Pokéball sprite
          ctx.fillStyle = '#ef4444';
          ctx.beginPath();
          ctx.arc(x + 16, y + 16, 7, Math.PI, 0);
          ctx.fill();
          ctx.fillStyle = '#fff';
          ctx.beginPath();
          ctx.arc(x + 16, y + 16, 7, 0, Math.PI);
          ctx.fill();
          ctx.fillStyle = '#000';
          ctx.fillRect(x + 9, y + 15, 14, 2);
          ctx.beginPath();
          ctx.arc(x + 16, y + 16, 3, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#fff';
          ctx.beginPath();
          ctx.arc(x + 16, y + 16, 1.5, 0, Math.PI * 2);
          ctx.fill();
          break;
      }
    }

    // Player Sprite Painter (Emerald Brendan)
    drawPlayer(x, y) {
      const ctx = this.ctx;
      const p = this.player;

      ctx.save();
      ctx.translate(x, y);

      // Walk bob
      const bob = (p.animFrame % 2 === 1 && p.moving) ? -2 : 0;

      // Shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
      ctx.beginPath();
      ctx.ellipse(16, 28, 8, 4, 0, 0, Math.PI * 2);
      ctx.fill();

      // Body / Clothes
      ctx.fillStyle = '#dc2626'; // Red hoodie / jacket
      ctx.fillRect(10, 14 + bob, 12, 10);

      // Backpack (Emerald Green)
      ctx.fillStyle = '#10b981';
      if (p.dir === 'down') ctx.fillRect(12, 16 + bob, 8, 6);
      if (p.dir === 'up') ctx.fillRect(11, 14 + bob, 10, 8);
      if (p.dir === 'left') ctx.fillRect(18, 15 + bob, 4, 8);
      if (p.dir === 'right') ctx.fillRect(10, 15 + bob, 4, 8);

      // Head / Face
      ctx.fillStyle = '#fed7aa'; // Skin tone
      ctx.fillRect(11, 6 + bob, 10, 8);

      // Eyes
      ctx.fillStyle = '#0f172a';
      if (p.dir === 'down') {
        ctx.fillRect(13, 10 + bob, 2, 3);
        ctx.fillRect(17, 10 + bob, 2, 3);
      } else if (p.dir === 'left') {
        ctx.fillRect(12, 10 + bob, 2, 3);
      } else if (p.dir === 'right') {
        ctx.fillRect(18, 10 + bob, 2, 3);
      }

      // Brendan's iconic White Band & Green Cap
      ctx.fillStyle = '#f8fafc'; // White band
      ctx.fillRect(10, 5 + bob, 12, 3);
      ctx.fillStyle = '#15803d'; // Green cap
      ctx.fillRect(11, 2 + bob, 10, 4);

      // Legs & Running Shoes
      ctx.fillStyle = '#1e293b'; // Black pants
      const legOffset = (p.animFrame === 1) ? 2 : (p.animFrame === 3 ? -2 : 0);
      ctx.fillRect(11, 24, 4, 4 + legOffset);
      ctx.fillRect(17, 24, 4, 4 - legOffset);

      // Red Running shoes
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(10, 27 + legOffset, 5, 3);
      ctx.fillRect(17, 27 - legOffset, 5, 3);

      ctx.restore();
    }

    // NPC Sprite Painter
    drawNPC(npc, x, y) {
      const ctx = this.ctx;

      // Special Boss Rayquaza Sprite
      if (npc.isBoss) {
        const ray = getSprite(384, false);
        if (ray && ray.complete && ray.naturalWidth > 0) {
          ctx.drawImage(ray, x - 16, y - 24, 64, 64);
          return;
        }
      }

      ctx.save();
      ctx.translate(x, y);

      // Shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
      ctx.beginPath();
      ctx.ellipse(16, 28, 8, 4, 0, 0, Math.PI * 2);
      ctx.fill();

      // Clothing Color by NPC
      let bodyColor = '#3b82f6';
      let hairColor = '#78350f';
      if (npc.id === 'mom') { bodyColor = '#ec4899'; hairColor = '#92400e'; }
      if (npc.id === 'birch') { bodyColor = '#f8fafc'; hairColor = '#475569'; } // Lab coat
      if (npc.id === 'nurse_joy') { bodyColor = '#f43f5e'; hairColor = '#ec4899'; }
      if (npc.id === 'mart_clerk') { bodyColor = '#0284c7'; hairColor = '#1e293b'; }

      // Body
      ctx.fillStyle = bodyColor;
      ctx.fillRect(10, 14, 12, 11);

      // Head
      ctx.fillStyle = '#fed7aa';
      ctx.fillRect(11, 6, 10, 8);

      // Hair
      ctx.fillStyle = hairColor;
      ctx.fillRect(10, 3, 12, 5);

      // Eyes
      ctx.fillStyle = '#000';
      if (npc.dir === 'down') {
        ctx.fillRect(13, 9, 2, 2);
        ctx.fillRect(17, 9, 2, 2);
      } else if (npc.dir === 'left') {
        ctx.fillRect(12, 9, 2, 2);
      } else if (npc.dir === 'right') {
        ctx.fillRect(18, 9, 2, 2);
      }

      // Legs
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(11, 24, 4, 5);
      ctx.fillRect(17, 24, 4, 5);

      ctx.restore();
    }

    // ------------------------------------------------------------------------
    // Dialogue Box Render
    // ------------------------------------------------------------------------
    renderDialogueBox() {
      const ctx = this.ctx;
      const d = this.dialogue;
      const text = d.lines[d.curLine] || '';
      const visibleText = text.slice(0, d.charIndex);

      // Classic Emerald Dialogue Box
      ctx.fillStyle = '#064e3b';
      ctx.fillRect(16, CANVAS_H - 86, CANVAS_W - 32, 74);
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(20, CANVAS_H - 82, CANVAS_W - 40, 66);
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 2;
      ctx.strokeRect(20, CANVAS_H - 82, CANVAS_W - 40, 66);

      ctx.fillStyle = '#0f172a';
      ctx.font = '10px "Press Start 2P", monospace';

      // Split into two lines
      const parts = visibleText.split('\n');
      if (parts.length > 1) {
        ctx.fillText(parts[0], 36, CANVAS_H - 58);
        ctx.fillText(parts[1], 36, CANVAS_H - 38);
      } else {
        // Auto word-wrap at ~34 chars
        if (visibleText.length > 34) {
          const cut = visibleText.lastIndexOf(' ', 34);
          const l1 = visibleText.slice(0, cut !== -1 ? cut : 34);
          const l2 = visibleText.slice(cut !== -1 ? cut + 1 : 34);
          ctx.fillText(l1, 36, CANVAS_H - 58);
          ctx.fillText(l2, 36, CANVAS_H - 38);
        } else {
          ctx.fillText(visibleText, 36, CANVAS_H - 48);
        }
      }

      // Bouncing prompt arrow when line is fully revealed
      if (d.charIndex >= text.length) {
        const arrowBounce = Math.sin(Date.now() / 200) * 3;
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.moveTo(CANVAS_W - 40, CANVAS_H - 28 + arrowBounce);
        ctx.lineTo(CANVAS_W - 32, CANVAS_H - 28 + arrowBounce);
        ctx.lineTo(CANVAS_W - 36, CANVAS_H - 22 + arrowBounce);
        ctx.fill();
      }
    }

    // ------------------------------------------------------------------------
    // Battle Screen Render
    // ------------------------------------------------------------------------
    renderBattle() {
      const ctx = this.ctx;
      const b = this.battle;
      if (!b) return;

      // Shake effect
      ctx.save();
      if (b.shakeTimer > 0) {
        const shakeX = (Math.random() - 0.5) * 8;
        const shakeY = (Math.random() - 0.5) * 8;
        ctx.translate(shakeX, shakeY);
      }

      // Emerald Battle Background (Hoenn Grassland)
      const grad = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
      grad.addColorStop(0, '#7dd3fc'); // Sky blue
      grad.addColorStop(0.55, '#bae6fd');
      grad.addColorStop(0.55, '#86efac'); // Field green
      grad.addColorStop(1, '#22c55e');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

      // Opponent Platform (top right)
      ctx.fillStyle = '#15803d';
      ctx.beginPath();
      ctx.ellipse(340, 130, 90, 24, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#4ade80';
      ctx.beginPath();
      ctx.ellipse(340, 128, 84, 20, 0, 0, Math.PI * 2);
      ctx.fill();

      // Player Platform (bottom left)
      ctx.fillStyle = '#15803d';
      ctx.beginPath();
      ctx.ellipse(140, 230, 110, 30, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#4ade80';
      ctx.beginPath();
      ctx.ellipse(140, 227, 102, 26, 0, 0, Math.PI * 2);
      ctx.fill();

      // Draw Wild Pokemon Front Sprite
      if (b.phase !== 'TRANSITION') {
        const wildImg = getSprite(b.wild.speciesId, false);
        if (wildImg && wildImg.complete && wildImg.naturalWidth > 0) {
          ctx.drawImage(wildImg, 290, 50, 96, 96);
        } else {
          // Fallback procedural circle
          ctx.fillStyle = TYPE_COLORS[b.wild.type] || '#f59e0b';
          ctx.beginPath();
          ctx.arc(340, 100, 36, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Draw Player Pokemon Back Sprite
      if (b.phase !== 'TRANSITION') {
        const playerImg = getSprite(b.playerPk.speciesId, true);
        if (playerImg && playerImg.complete && playerImg.naturalWidth > 0) {
          ctx.drawImage(playerImg, 80, 140, 110, 110);
        } else {
          // Fallback procedural circle
          ctx.fillStyle = TYPE_COLORS[b.playerPk.type] || '#10b981';
          ctx.beginPath();
          ctx.arc(140, 190, 42, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Catch Animation - Pokéball on ground
      if (b.phase === 'CATCH_ANIM') {
        const wobble = Math.sin(Date.now() / 80) * (b.ballWobbles > 0 ? 12 : 0);
        ctx.save();
        ctx.translate(340, 115);
        ctx.rotate(wobble * Math.PI / 180);
        // Draw Pokeball
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.arc(0, 0, 10, Math.PI, 0);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(0, 0, 10, 0, Math.PI);
        ctx.fill();
        ctx.fillStyle = '#000';
        ctx.fillRect(-10, -1, 20, 2);
        ctx.beginPath();
        ctx.arc(0, 0, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(0, 0, 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // ----------------------------------------------------------------------
      // Opponent HUD Box (Top Left)
      // ----------------------------------------------------------------------
      ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
      ctx.fillRect(30, 30, 180, 50);
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2;
      ctx.strokeRect(30, 30, 180, 50);

      ctx.fillStyle = '#ffffff';
      ctx.font = '9px "Press Start 2P", monospace';
      ctx.fillText(b.wild.name, 40, 46);
      ctx.fillStyle = (b.wild.gender === '♂') ? '#60a5fa' : '#f472b6';
      ctx.fillText(b.wild.gender, 150, 46);

      ctx.fillStyle = '#fef08a';
      ctx.font = '8px "Press Start 2P", monospace';
      ctx.fillText(`Lv${b.wild.level}`, 170, 46);

      // Opponent HP Bar
      this.drawHpBar(80, 58, 120, 8, b.wild.curHp, b.wild.maxHp);

      // ----------------------------------------------------------------------
      // Player HUD Box (Bottom Right)
      // ----------------------------------------------------------------------
      ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
      ctx.fillRect(260, 175, 195, 62);
      ctx.strokeStyle = '#34d399';
      ctx.lineWidth = 2;
      ctx.strokeRect(260, 175, 195, 62);

      ctx.fillStyle = '#ffffff';
      ctx.font = '9px "Press Start 2P", monospace';
      ctx.fillText(b.playerPk.name, 270, 191);
      ctx.fillStyle = (b.playerPk.gender === '♂') ? '#60a5fa' : '#f472b6';
      ctx.fillText(b.playerPk.gender, 390, 191);

      ctx.fillStyle = '#fef08a';
      ctx.font = '8px "Press Start 2P", monospace';
      ctx.fillText(`Lv${b.playerPk.level}`, 415, 191);

      // Player HP Bar
      this.drawHpBar(320, 202, 125, 8, b.playerPk.curHp, b.playerPk.maxHp);

      // Player HP Numbers (e.g. 24 / 24)
      ctx.fillStyle = '#ffffff';
      ctx.font = '7px "Press Start 2P", monospace';
      ctx.fillText(`${b.playerPk.curHp} / ${b.playerPk.maxHp}`, 360, 222);

      // Player EXP Bar (Blue)
      const expPercent = Math.max(0, Math.min(1, (b.playerPk.exp % 100) / 100));
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(320, 228, 125, 3);
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(320, 228, Math.floor(125 * expPercent), 3);

      // ----------------------------------------------------------------------
      // Battle Bottom Dialogue & Menus
      // ----------------------------------------------------------------------
      // Base Box
      ctx.fillStyle = '#064e3b';
      ctx.fillRect(0, CANVAS_H - 78, CANVAS_W, 78);
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(4, CANVAS_H - 74, CANVAS_W - 8, 70);
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 2;
      ctx.strokeRect(4, CANVAS_H - 74, CANVAS_W - 8, 70);

      // If we are in MAIN MENU: split into message on left, 4 buttons on right
      if (b.phase === 'MENU_MAIN') {
        ctx.fillStyle = '#0f172a';
        ctx.font = '10px "Press Start 2P", monospace';
        ctx.fillText(`What will`, 20, CANVAS_H - 46);
        ctx.fillText(`${b.playerPk.name} do?`, 20, CANVAS_H - 26);

        // 4 Command Buttons (FIGHT, BAG, POKÉMON, RUN)
        const opts = ['FIGHT', 'BAG', 'POKéMON', 'RUN'];
        const coords = [
          [280, CANVAS_H - 48],
          [380, CANVAS_H - 48],
          [280, CANVAS_H - 24],
          [380, CANVAS_H - 24]
        ];

        opts.forEach((opt, idx) => {
          const [ox, oy] = coords[idx];
          const isSel = (idx === b.subIndex);
          if (isSel) {
            ctx.fillStyle = '#ef4444';
            ctx.beginPath();
            ctx.moveTo(ox - 10, oy - 8);
            ctx.lineTo(ox - 4, oy - 4);
            ctx.lineTo(ox - 10, oy);
            ctx.fill();
          }
          ctx.fillStyle = isSel ? '#dc2626' : '#1e293b';
          ctx.fillText(opt, ox, oy);
        });
      } else if (b.phase === 'MENU_FIGHT') {
        // Move selection (4 Moves)
        const moves = b.playerPk.moves;
        const coords = [
          [24, CANVAS_H - 48],
          [160, CANVAS_H - 48],
          [24, CANVAS_H - 24],
          [160, CANVAS_H - 24]
        ];

        moves.forEach((m, idx) => {
          const [mx, my] = coords[idx];
          const isSel = (idx === b.subIndex);
          if (isSel) {
            ctx.fillStyle = '#ef4444';
            ctx.beginPath();
            ctx.moveTo(mx - 8, my - 8);
            ctx.lineTo(mx - 2, my - 4);
            ctx.lineTo(mx - 8, my);
            ctx.fill();
          }
          ctx.fillStyle = isSel ? '#dc2626' : '#0f172a';
          ctx.font = '8px "Press Start 2P", monospace';
          ctx.fillText(m.name.toUpperCase(), mx, my);
        });

        // Right side info (TYPE and PP)
        const selMove = moves[b.subIndex];
        if (selMove) {
          ctx.fillStyle = '#1e293b';
          ctx.fillRect(320, CANVAS_H - 70, 148, 62);
          ctx.fillStyle = TYPE_COLORS[selMove.type] || '#fff';
          ctx.font = '8px "Press Start 2P", monospace';
          ctx.fillText(`TYPE/${selMove.type}`, 330, CANVAS_H - 48);
          ctx.fillStyle = '#ffffff';
          ctx.fillText(`PP  ${selMove.curPp}/${selMove.maxPp}`, 330, CANVAS_H - 26);
        }
      } else if (b.phase === 'MENU_BAG') {
        const bagList = [
          `POKé BALL  x${this.player.bag.pokeballs}`,
          `GREAT BALL x${this.player.bag.greatballs}`,
          `POTION     x${this.player.bag.potions}`,
          `SUPER POT. x${this.player.bag.superpotions}`
        ];
        ctx.fillStyle = '#0f172a';
        ctx.font = '8px "Press Start 2P", monospace';

        bagList.forEach((item, idx) => {
          const y = CANVAS_H - 58 + (idx % 2) * 24;
          const x = idx < 2 ? 30 : 250;
          if (idx === b.subIndex) {
            ctx.fillStyle = '#ef4444';
            ctx.fillText('▶ ' + item, x, y);
          } else {
            ctx.fillStyle = '#0f172a';
            ctx.fillText('  ' + item, x, y);
          }
        });
      } else if (b.phase === 'MENU_PARTY') {
        ctx.fillStyle = '#0f172a';
        ctx.font = '8px "Press Start 2P", monospace';
        this.player.party.forEach((pk, idx) => {
          const x = idx < 3 ? 30 : 240;
          const y = CANVAS_H - 60 + (idx % 3) * 18;
          const sel = (idx === b.subIndex ? '▶ ' : '  ');
          ctx.fillStyle = idx === b.subIndex ? '#ef4444' : '#0f172a';
          ctx.fillText(`${sel}${pk.name} Lv${pk.level} (${pk.curHp}/${pk.maxHp})`, x, y);
        });
      } else {
        // Dialogue or notification text
        ctx.fillStyle = '#0f172a';
        ctx.font = '9px "Press Start 2P", monospace';
        const lines = b.text.split('\n');
        lines.forEach((l, i) => {
          ctx.fillText(l, 24, CANVAS_H - 48 + i * 20);
        });

        // Bouncing prompt arrow
        const bounce = Math.sin(Date.now() / 200) * 3;
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.moveTo(CANVAS_W - 30, CANVAS_H - 24 + bounce);
        ctx.lineTo(CANVAS_W - 22, CANVAS_H - 24 + bounce);
        ctx.lineTo(CANVAS_W - 26, CANVAS_H - 18 + bounce);
        ctx.fill();
      }

      ctx.restore();
    }

    // HP Bar Painter (Green -> Yellow -> Red)
    drawHpBar(x, y, w, h, cur, max) {
      const ctx = this.ctx;
      const ratio = Math.max(0, Math.min(1, cur / max));

      // Label "HP"
      ctx.fillStyle = '#fbbf24';
      ctx.font = '7px "Press Start 2P", monospace';
      ctx.fillText('HP', x - 18, y + 7);

      // Background
      ctx.fillStyle = '#334155';
      ctx.fillRect(x, y, w, h);

      // Color
      let color = '#22c55e'; // Green
      if (ratio <= 0.2) color = '#ef4444'; // Red
      else if (ratio <= 0.5) color = '#eab308'; // Yellow

      ctx.fillStyle = color;
      ctx.fillRect(x, y, Math.floor(w * ratio), h);

      // Border
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 1;
      ctx.strokeRect(x, y, w, h);
    }

    // ------------------------------------------------------------------------
    // Evolution Screen Render
    // ------------------------------------------------------------------------
    renderEvolution() {
      const ctx = this.ctx;
      const ev = this.evolution;

      // Dark starry background
      ctx.fillStyle = '#020617';
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

      // Swirling particles
      for (let i = 0; i < 20; i++) {
        const ang = (Date.now() / 300) + (i * Math.PI / 10);
        const rad = 60 + Math.sin(Date.now() / 200 + i) * 20;
        const px = CANVAS_W / 2 + Math.cos(ang) * rad;
        const py = CANVAS_H / 2 - 20 + Math.sin(ang) * rad;
        ctx.fillStyle = '#38bdf8';
        ctx.fillRect(px, py, 4, 4);
      }

      // Sprite Display
      const currentId = (ev.phase === 'TRANSFORM' && ev.flash) ? ev.targetSpec.id : ev.pk.speciesId;
      const spr = getSprite(currentId, false);
      if (spr && spr.complete) {
        ctx.drawImage(spr, CANVAS_W / 2 - 48, CANVAS_H / 2 - 68, 96, 96);
      }

      // Dialogue Box
      ctx.fillStyle = '#064e3b';
      ctx.fillRect(16, CANVAS_H - 86, CANVAS_W - 32, 74);
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(20, CANVAS_H - 82, CANVAS_W - 40, 66);
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 2;
      ctx.strokeRect(20, CANVAS_H - 82, CANVAS_W - 40, 66);

      ctx.fillStyle = '#0f172a';
      ctx.font = '9px "Press Start 2P", monospace';

      if (ev.phase === 'INTRO' || ev.phase === 'TRANSFORM') {
        ctx.fillText(`What? ${ev.pk.name}`, 36, CANVAS_H - 52);
        ctx.fillText(`is evolving!`, 36, CANVAS_H - 32);
      } else {
        ctx.fillText(`Congratulations! Your ${ev.pk.name}`, 36, CANVAS_H - 52);
        ctx.fillText(`evolved into ${ev.targetSpec.name}!`, 36, CANVAS_H - 32);
      }
    }

    // ------------------------------------------------------------------------
    // Start Menu Render
    // ------------------------------------------------------------------------
    renderStartMenu() {
      const ctx = this.ctx;
      const menuW = 140;
      const menuH = 170;
      const menuX = CANVAS_W - menuW - 12;
      const menuY = 12;

      ctx.fillStyle = '#064e3b';
      ctx.fillRect(menuX, menuY, menuW, menuH);
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(menuX + 4, menuY + 4, menuW - 8, menuH - 8);
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 2;
      ctx.strokeRect(menuX + 4, menuY + 4, menuW - 8, menuH - 8);

      ctx.font = '9px "Press Start 2P", monospace';
      this.menuItems.forEach((item, idx) => {
        const y = menuY + 28 + idx * 24;
        const isSel = (idx === this.menuIndex);
        if (isSel) {
          ctx.fillStyle = '#ef4444';
          ctx.beginPath();
          ctx.moveTo(menuX + 14, y - 8);
          ctx.lineTo(menuX + 20, y - 4);
          ctx.lineTo(menuX + 14, y);
          ctx.fill();
        }
        ctx.fillStyle = isSel ? '#dc2626' : '#0f172a';
        ctx.fillText(item, menuX + 26, y - 2);
      });
    }

    // ------------------------------------------------------------------------
    // Pokédex View Render
    // ------------------------------------------------------------------------
    renderPokedex() {
      const ctx = this.ctx;
      ctx.fillStyle = 'rgba(6, 78, 59, 0.95)';
      ctx.fillRect(20, 20, CANVAS_W - 40, CANVAS_H - 40);
      ctx.strokeStyle = '#34d399';
      ctx.lineWidth = 2;
      ctx.strokeRect(20, 20, CANVAS_W - 40, CANVAS_H - 40);

      ctx.fillStyle = '#ffffff';
      ctx.font = '11px "Press Start 2P", monospace';
      ctx.fillText('HOENN POKéDEX', 40, 48);

      ctx.font = '8px "Press Start 2P", monospace';
      ctx.fillStyle = '#fef08a';
      ctx.fillText(`SEEN: ${this.player.seenPokemon.size}   CAUGHT: ${this.player.caughtPokemon.size}`, 40, 68);

      // Grid of Pokémon
      const allIds = Object.keys(POKEMON_DB);
      allIds.slice(0, 12).forEach((id, idx) => {
        const pk = POKEMON_DB[id];
        const col = idx % 3;
        const row = Math.floor(idx / 3);
        const x = 40 + col * 135;
        const y = 90 + row * 45;

        const isCaught = this.player.caughtPokemon.has(pk.id);
        const isSeen = this.player.seenPokemon.has(pk.id);

        ctx.fillStyle = isCaught ? '#10b981' : (isSeen ? '#f59e0b' : '#64748b');
        ctx.fillRect(x, y, 125, 36);

        ctx.fillStyle = '#ffffff';
        ctx.font = '7px "Press Start 2P", monospace';
        ctx.fillText(`No.${pk.id}`, x + 6, y + 14);

        if (isSeen || isCaught) {
          ctx.fillText(pk.name, x + 6, y + 26);
          const spr = getSprite(pk.id, false);
          if (spr && spr.complete) {
            ctx.drawImage(spr, x + 90, y + 2, 32, 32);
          }
        } else {
          ctx.fillText('?????', x + 6, y + 26);
        }
      });

      ctx.fillStyle = '#cbd5e1';
      ctx.font = '7px "Press Start 2P", monospace';
      ctx.fillText('PRESS B / X TO RETURN', CANVAS_W / 2 - 70, CANVAS_H - 30);
    }

    // ------------------------------------------------------------------------
    // Party Menu Render
    // ------------------------------------------------------------------------
    renderPartyMenu() {
      const ctx = this.ctx;
      ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
      ctx.fillRect(20, 20, CANVAS_W - 40, CANVAS_H - 40);
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2;
      ctx.strokeRect(20, 20, CANVAS_W - 40, CANVAS_H - 40);

      ctx.fillStyle = '#ffffff';
      ctx.font = '11px "Press Start 2P", monospace';
      ctx.fillText('POKéMON TEAM', 40, 48);

      this.player.party.forEach((pk, idx) => {
        const y = 70 + idx * 34;
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(40, y, CANVAS_W - 80, 28);

        // Sprite
        const spr = getSprite(pk.speciesId, false);
        if (spr && spr.complete) {
          ctx.drawImage(spr, 44, y - 2, 30, 30);
        }

        ctx.fillStyle = '#ffffff';
        ctx.font = '8px "Press Start 2P", monospace';
        ctx.fillText(pk.name, 80, y + 14);
        ctx.fillStyle = '#fef08a';
        ctx.fillText(`Lv${pk.level}`, 180, y + 14);

        // HP Bar
        this.drawHpBar(240, y + 8, 100, 6, pk.curHp, pk.maxHp);
        ctx.fillStyle = '#ffffff';
        ctx.font = '7px "Press Start 2P", monospace';
        ctx.fillText(`${pk.curHp}/${pk.maxHp}`, 350, y + 14);
      });

      ctx.fillStyle = '#cbd5e1';
      ctx.font = '7px "Press Start 2P", monospace';
      ctx.fillText('PRESS B / X TO RETURN', CANVAS_W / 2 - 70, CANVAS_H - 30);
    }

    // ------------------------------------------------------------------------
    // Bag Menu Render
    // ------------------------------------------------------------------------
    renderBagMenu() {
      const ctx = this.ctx;
      ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
      ctx.fillRect(20, 20, CANVAS_W - 40, CANVAS_H - 40);
      ctx.strokeStyle = '#eab308';
      ctx.lineWidth = 2;
      ctx.strokeRect(20, 20, CANVAS_W - 40, CANVAS_H - 40);

      ctx.fillStyle = '#ffffff';
      ctx.font = '11px "Press Start 2P", monospace';
      ctx.fillText('BAG INVENTORY', 40, 48);

      const items = [
        { name: 'POKé BALL', count: this.player.bag.pokeballs, desc: 'A device for catching wild Pokémon.' },
        { name: 'GREAT BALL', count: this.player.bag.greatballs, desc: 'A good Ball with a higher catch rate.' },
        { name: 'POTION', count: this.player.bag.potions, desc: 'Restores 20 HP to a wounded Pokémon.' },
        { name: 'SUPER POTION', count: this.player.bag.superpotions, desc: 'Restores 50 HP to a wounded Pokémon.' },
        { name: 'RUNNING SHOES', count: 1, desc: 'Hold SHIFT or B to sprint at double speed!' }
      ];

      items.forEach((item, idx) => {
        const y = 75 + idx * 36;
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(40, y, CANVAS_W - 80, 30);

        ctx.fillStyle = '#fde047';
        ctx.font = '8px "Press Start 2P", monospace';
        ctx.fillText(item.name, 50, y + 14);
        ctx.fillStyle = '#ffffff';
        ctx.fillText(`x ${item.count}`, 220, y + 14);

        ctx.fillStyle = '#94a3b8';
        ctx.font = '6px "Press Start 2P", monospace';
        ctx.fillText(item.desc, 50, y + 24);
      });

      ctx.fillStyle = '#cbd5e1';
      ctx.font = '7px "Press Start 2P", monospace';
      ctx.fillText('PRESS B / X TO RETURN', CANVAS_W / 2 - 70, CANVAS_H - 30);
    }

    // ------------------------------------------------------------------------
    // Trainer Card Render
    // ------------------------------------------------------------------------
    renderTrainerCard() {
      const ctx = this.ctx;
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(40, 30, CANVAS_W - 80, CANVAS_H - 60);
      ctx.strokeStyle = '#34d399';
      ctx.lineWidth = 3;
      ctx.strokeRect(40, 30, CANVAS_W - 80, CANVAS_H - 60);

      // Card Header
      ctx.fillStyle = '#10b981';
      ctx.fillRect(40, 30, CANVAS_W - 80, 35);
      ctx.fillStyle = '#ffffff';
      ctx.font = '10px "Press Start 2P", monospace';
      ctx.fillText('TRAINER CARD', 60, 52);

      // Trainer Info
      ctx.fillStyle = '#ffffff';
      ctx.font = '9px "Press Start 2P", monospace';
      ctx.fillText(`NAME: ${this.player.name}`, 60, 95);
      ctx.fillText(`MONEY: ¥${this.player.money}`, 60, 125);
      ctx.fillText(`POKéDEX: ${this.player.caughtPokemon.size}`, 60, 155);
      ctx.fillText(`BADGES:  1 [STONE BADGE]`, 60, 185);

      // Brendan Avatar on right
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(310, 80, 80, 100);
      ctx.strokeStyle = '#64748b';
      ctx.strokeRect(310, 80, 80, 100);

      this.drawPlayer(335, 115);

      ctx.fillStyle = '#94a3b8';
      ctx.font = '7px "Press Start 2P", monospace';
      ctx.fillText('PRESS B / X TO RETURN', CANVAS_W / 2 - 70, CANVAS_H - 45);
    }
  }

  // ==========================================================================
  // 15. BOOTSTRAP ENGINE ON DOM READY
  // ==========================================================================
  window.addEventListener('DOMContentLoaded', () => {
    window.emeraldGame = new Game();
  });
})();
