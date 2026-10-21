window.HERO_POOL = [
  {
    id: 'anubis',
    n: 'Anubis',
    c: 5,
    hp: 1650, dmg: 175, sp: 2.1, rng: 0.8, rate: 1.2, size: 0.65,
    col: '#d4a15a', emoji: '🐕‍🦺', isHero: true,
    abilityName: 'Sand Dash',
    abilityCost: 1,
    abilityCooldown: 8,
    abilityDesc: 'Dashes 3 tiles, 300 AoE.'
  },
  {
    id: 'oracle',
    n: 'Oracle',
    c: 4,
    hp: 900, dmg: 120, sp: 2.3, rng: 4.5, rate: 1.1, size: 0.5,
    col: '#ffd54f', emoji: '☀️', isHero: true,
    abilityName: 'Solar Flare',
    abilityCost: 1,
    abilityCooldown: 10,
    abilityDesc: 'AoE 280 dmg + 1.5s stun.'
  },
  {
    id: 'champion',
    n: 'Champion',
    c: 5,
    hp: 1900, dmg: 150, sp: 1.7, rng: 0.8, rate: 1.3, size: 0.75,
    col: '#e8c170', emoji: '🛡️', isHero: true,
    abilityName: 'Divine Guard',
    abilityCost: 1,
    abilityCooldown: 11,
    abilityDesc: 'Heal 450 + shield 4s.'
  }
];

window.HeroSystem = (() => {
  const EF = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
  
  const HERO_ABILITIES = {
    'Anubis': {
      name: 'Sand Dash',
      cost: 1,
      cooldown: 8,
      execute: (h, units, time) => {
        h.y = Math.max(1, h.y - 3);
        units.forEach(e => {
          if (e.team !== h.team && e.hp > 0 && Math.hypot(e.x - h.x, e.y - h.y) <= 2.0) {
            e.hp -= 300;
          }
        });
      }
    },
    'Oracle': {
      name: 'Solar Flare',
      cost: 1,
      cooldown: 10,
      execute: (h, units, time) => {
        units.forEach(e => {
          if (e.team !== h.team && e.hp > 0 && Math.hypot(e.x - h.x, e.y - h.y) <= 3.0) {
            e.hp -= 280;
            e.stunUntil = Math.max(e.stunUntil || 0, time + 1.5);
          }
        });
      }
    },
    'Champion': {
      name: 'Divine Guard',
      cost: 1,
      cooldown: 11,
      execute: (h, units, time) => {
        h.hp = Math.min(h.maxHp, h.hp + 450);
        h.dmgReductionUntil = time + 4;
      }
    }
  };

  let activeHero = null;
  let activeHeroCard = null;
  let cooldownTimer = 0;
  let bridgeRef = null;
  let currentTime = 0;

  function onGameStart() {
    activeHero = null;
    activeHeroCard = null;
    cooldownTimer = 0;
  }

  function onHeroSpawn(heroUnit) {
    activeHero = heroUnit;
    // Find which ability matches this emoji
    activeHeroCard = { n: activeHero.emoji === '🐕‍🦺' ? 'Anubis' : (activeHero.emoji === '☀️' ? 'Oracle' : 'Champion') };
    cooldownTimer = 0;
  }

  function hasActiveHero() {
    return activeHero !== null && activeHero.hp > 0;
  }

  function onAbilityClick(elixRef) {
    if (!activeHero || activeHero.hp <= 0) return false;
    if (cooldownTimer > 0) return false;
    if (!activeHeroCard) return false;

    const ability = HERO_ABILITIES[activeHeroCard.n];
    if (!ability) return false;

    if (elixRef[0] < ability.cost) return false;

    elixRef[0] -= ability.cost;
    cooldownTimer = ability.cooldown;
    
    // Trigger effect
    if (bridgeRef) {
      const st = bridgeRef.getState();
      ability.execute(activeHero, st.units, currentTime);
    }
    return true;
  }

  function tick(bridge, dt) {
    if (!bridge) return;
    bridgeRef = bridge;
    const st = bridge.getState();
    if (st && typeof st.time === 'number') currentTime = st.time;

    // Verify the active hero is still alive
    if (activeHero) {
      const stillAlive = st.units.find(u => u === activeHero && u.hp > 0);
      if (!stillAlive) {
        activeHero = null;
        activeHeroCard = null;
        cooldownTimer = 0;
      }
    }

    if (cooldownTimer > 0) {
      cooldownTimer -= dt;
      if (cooldownTimer < 0) cooldownTimer = 0;
    }
  }

  function draw(ctx, time) {
    // Main game handles the yellow border
  }

  function drawHUD(ctx, hx, hy, hw, hh, elixir) {
    if (!hasActiveHero() || !activeHeroCard) return;

    const ability = HERO_ABILITIES[activeHeroCard.n];
    if (!ability) return;

    const ready = cooldownTimer <= 0;
    const canAfford = elixir >= ability.cost;

    ctx.fillStyle = (ready && canAfford) ? '#3a2a4a' : '#151520';
    ctx.fillRect(hx, hy, hw, hh);
    
    ctx.strokeStyle = (ready && canAfford) ? '#b060e0' : '#444';
    ctx.lineWidth = 2;
    ctx.strokeRect(hx, hy, hw, hh);

    if (ready && canAfford) {
      const pulse = 0.5 + 0.5 * Math.sin(currentTime * 6);
      ctx.strokeStyle = 'rgba(176, 96, 224, ' + (0.3 + 0.5 * pulse) + ')';
      ctx.lineWidth = 2;
      ctx.strokeRect(hx - 1, hy - 1, hw + 2, hh + 2);
    }

    ctx.font = '16px ' + EF;
    ctx.fillStyle = (ready && canAfford) ? '#fff' : '#666';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('✨', hx + hw / 2, hy + 20);

    ctx.fillStyle = (ready && canAfford) ? '#b060e0' : '#555';
    ctx.font = 'bold 7px system-ui';
    ctx.fillText('ABILITY', hx + hw / 2, hy + 36);

    ctx.fillStyle = canAfford ? '#c026d3' : '#5a2a6a';
    ctx.beginPath();
    ctx.arc(hx + 12, hy + hh - 12, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 11px system-ui';
    ctx.fillText(ability.cost, hx + 12, hy + hh - 8);

    if (!ready) {
      const frac = Math.max(0, Math.min(1, cooldownTimer / ability.cooldown));
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.beginPath();
      ctx.moveTo(hx + hw / 2, hy + hh / 2);
      ctx.arc(hx + hw / 2, hy + hh / 2, hw, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#fff';
      ctx.font = 'bold 14px system-ui';
      ctx.fillText(Math.ceil(cooldownTimer), hx + hw / 2, hy + hh / 2);
    }
  }

  return {
    onGameStart,
    onHeroSpawn,
    onAbilityClick,
    tick,
    draw,
    drawHUD,
    hasActiveHero
  };
})();