/* ============================================================
   ai.js — external AI module for Mini Royale
   Loads into window.AI. Compatible with GameBridge v1.
   ============================================================ */

window.AI = (() => {
  let timer = 0;

  function classify(c) {
    if (c.towerOnly) return 'pusher';
    const cnt = c.count || 1;
    if (cnt >= 3 && c.hp < 250) return 'swarm';
    if (c.rng >= 4) return 'ranged';
    if (c.hp >= 1000 && c.rng < 2.5) return 'tank';
    return 'fighter';
  }

  function effDps(c) {
    const cnt = c.count || 1;
    const dmg = (c.ancientReady && c.ancientStats && c.ancientStats.dmg) || c.dmg;
    return (dmg / c.rate) * cnt;
  }

  function effHp(c) {
    const cnt = c.count || 1;
    const hp = (c.ancientReady && c.ancientStats && c.ancientStats.hp) || c.hp;
    return hp * cnt;
  }

  function scoreDefender(c, threats) {
    if (c.towerOnly) return -999; // Never use pushers on defense
    
    const role = classify(c);
    const hasBigThreat = threats.some(u => u.hp > 600 || u.isHero);
    const hasHeroThreat = threats.some(u => u.isHero);
    const threatDps = threats.reduce((a, u) => a + u.dmg, 0);
    
    let s = 0;
    s += effDps(c) * 0.4;
    s += effHp(c) * 0.02;

    if (role === 'ranged') s += 25;
    if (hasBigThreat && role === 'swarm') s += 50;
    if (threats.length >= 2 && (role === 'tank' || role === 'fighter')) s += 20;
    if (threatDps > 200 && role === 'tank') s += 30;

    // --- NEW: HERO THREAT LOGIC ---
    if (hasHeroThreat) {
      if (role === 'swarm') s += 40;   // Surround the hero
      if (role === 'ranged') s += 35;  // Kite the hero from safety
      if (role === 'tank') s += 25;    // Soak the hero's damage
    }

    if (c.ancientReady) {
      s += 25;
      if (c.ancientStats && c.ancientStats.ability) s += 10;
    }
    s -= c.c * 5;
    return s;
  }

  function scorePusher(c, hasEnemyHero) {
    const role = classify(c);
    let s = 0;
    s += effDps(c) * 0.2;
    s += effHp(c) * 0.015;

    if (role === 'pusher') s += 60;
    if (role === 'tank')   s += 25;
    if (role === 'ranged') s += 15;
    
    // If the enemy doesn't have a Hero on the field, be more aggressive with pushing
    if (!hasEnemyHero) s += 20;
    
    if (c.ancientReady) s += 30;
    s -= c.c * 4;
    return s;
  }

  function bestCard(hand, myElixir, scorer, threats, hasEnemyHero) {
    let best = null, bestScore = -Infinity;
    for (let i = 0; i < hand.length; i++) {
      const c = hand[i];
      if (c.c > myElixir) continue;
      const sc = scorer(c, threats, hasEnemyHero);
      if (sc > bestScore) { bestScore = sc; best = { c, i }; }
    }
    return best;
  }

  function tick(bridge, dt) {
    timer -= dt;
    if (timer > 0) return;

    const s = bridge.getState();
    if (s.over) { timer = 1; return; }
    const K = s.constants;
    const hasEnemyHero = s.enemyUnits.some(u => u.isHero);

    // ============ 1. DEFEND ============
    const threats = s.enemyUnits.filter(u => u.y < K.RY + 2.5);
    if (threats.length) {
      const pick = bestCard(s.myHand, s.myElixir, scoreDefender, threats, hasEnemyHero);
      if (pick) {
        const leftT  = threats.filter(u => u.x < 9);
        const rightT = threats.filter(u => u.x >= 9);
        const leftDanger  = leftT.reduce((a, u) => a + u.dmg + (u.isHero?300:0), 0);
        const rightDanger = rightT.reduce((a, u) => a + u.dmg + (u.isHero?300:0), 0);
        const lane = leftDanger >= rightDanger ? 'L' : 'R';
        const laneThreats = lane === 'L' ? leftT : rightT;
        
        if (laneThreats.length) {
          const tower =
            s.myTowers.find(t => !t.king && t.alive && (lane === 'L' ? t.x < 9 : t.x > 9)) ||
            s.myTowers.find(t => t.king && t.alive);
          if (tower) {
            const closestY = Math.min(...laneThreats.map(u => u.y));
            let deployY = (tower.y + closestY) / 2;
            deployY = Math.max(1, Math.min(14, deployY));
            const deployX = (lane === 'L' ? K.BL : K.BR) + (Math.random() - 0.5) * 1.0;
            
            if (bridge.deploy(pick.i, deployX, deployY)) {
              timer = 0.4; // Defend fast
              return;
            }
          }
        }
      }
      timer = 0.35;
      return;
    }

    // ============ 2. PUSH ============
    const push = bestCard(s.myHand, s.myElixir, scorePusher, [], hasEnemyHero);
    if (push) {
      const eL = s.enemyTowers.find(t => !t.king && t.x < 9 && t.alive);
      const eR = s.enemyTowers.find(t => !t.king && t.x > 9 && t.alive);
      let lane;
      if (!eL && !eR) { timer = 0.5; return; }
      else if (!eL) lane = 'R';
      else if (!eR) lane = 'L';
      else lane = eL.hp <= eR.hp ? 'L' : 'R';
      
      const deployY = 9 + Math.random() * 3;
      const deployX = (lane === 'L' ? K.BL : K.BR) + (Math.random() - 0.5) * 1.5;
      
      if (bridge.deploy(push.i, deployX, deployY)) {
        timer = 0.9 + Math.random() * 0.7;
        return;
      }
    }
    timer = 0.4;
  }

  return {
    tick,
    onGameStart() { timer = 1.0; }
  };
})();