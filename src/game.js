import { GameMap, TILE_WALL } from './map.js';
import { Player, Monster, Item, CLASSES } from './entities.js';
import { UI } from './ui.js';

export class Game {
    constructor() {
        this.ui = new UI();
        this.storageKey = 'mud_save_v2'; // Force reset to clear "Fully Revealed" debug state
        this.loadGame();

        // Bind Inputs
        document.addEventListener('keydown', (e) => this.handleInput(e));
        document.getElementById('reset-btn').addEventListener('click', () => this.resetGame());
    }

    resetGame() {
        localStorage.removeItem(this.storageKey);
        location.reload();
    }

    start() {
        // If player loaded from save, skip welcome
        if (this.player && this.player.isAlive()) {
            const el = document.getElementById('character-select');
            if (el) el.remove();
            this.ui.initGrid(this.map.width, this.map.height);
            this.render();
        } else {
            // New Game Flow
            this.ui.initGrid(30, 20); // Temp grid
            this.handleCharacterSelection(); // Direct call
        }
    }

    handleWelcomeScreen() {
        // Direct transition
        this.handleCharacterSelection();
    }

    handleCharacterSelection() {
        console.log("DEBUG: handleCharacterSelection called");
        const screen = document.getElementById('character-select');
        if (!screen) {
            console.error("Critical: character-select element not found");
            return;
        }
        screen.classList.remove('hidden'); // Ensure visible
        // screen.style.display = 'flex'; // Handled by CSS class

        const grid = document.getElementById('class-selection-grid');
        if (!grid) {
            console.error("Critical: class-selection-grid element not found");
            return;
        }
        grid.innerHTML = '';

        // CSS for grid to allow side-by-side
        grid.style.display = 'flex';
        grid.style.gap = '2rem';
        grid.style.flexWrap = 'wrap';
        grid.style.justifyContent = 'center';

        console.log("DEBUG: Classes available:", Object.keys(CLASSES));

        Object.keys(CLASSES).forEach(key => {
            const cls = CLASSES[key];
            const card = document.createElement('div');
            card.className = 'class-card'; // Reuse fancy class

            // Image handling (fallback if png missing)
            // Note: Since I don't have thief.png, I might need to rely on the defined path or a placeholder
            // But the user requested a unified style.

            card.innerHTML = `
                <div class="card-image">
                   <img src="${cls.image}" alt="${cls.name}" style="width:200px; height:200px; object-fit:cover; border-radius:50%; border:4px solid var(--primary-color);">
                </div>
                <h2>${cls.name.toUpperCase()}</h2>
                <div class="stats-group">
                    <p><strong>❤️ Life:</strong> ${cls.stats.life} (+${cls.perks.lifePerLevel}/lvl)</p>
                    <p><strong>⚔️ Power:</strong> ${cls.stats.power} (+${cls.perks.powerPerLevel}/lvl)</p>
                    <p><strong>⚡ Stamina:</strong> ${cls.stats.stamina} (-${cls.perks.staminaCost}/move)</p>
                </div>
                <button class="btn-primary">SELECT ${cls.name.toUpperCase()}</button>
                <p class="flavor-text">${cls.description}</p>
            `;

            const btn = card.querySelector('button');
            btn.onclick = () => {
                screen.style.display = 'none'; // Hide overlay
                this.initNewGame(key);
            };

            grid.appendChild(card);
        });
    }

    // ---------------- SAVE / LOAD ---------------- //

    saveGame() {
        const state = {
            player: {
                x: this.player.x,
                y: this.player.y,
                life: this.player.life,
                stamina: this.player.stamina,
                basePower: this.player.basePower,
                inventory: this.player.inventory,
                equipment: this.player.equipment,
                xp: this.player.xp,
                level: this.player.level,
                nextLevelXp: this.player.nextLevelXp,
                maxLife: this.player.maxLife,
                classKey: this.player.classKey
            },
            map: {
                width: this.map.width,
                height: this.map.height,
                grid: this.map.grid,
                rooms: this.map.rooms,
                explored: this.map.explored,
                entities: this.map.entities
            },
            depth: this.depth
        };
        localStorage.setItem(this.storageKey, JSON.stringify(state));
    }

    loadGame() {
        const saved = localStorage.getItem(this.storageKey);

        if (saved) {
            try {
                const state = JSON.parse(saved);

                // Validation: If save lacks map data (old version), force reset
                if (!state.map || !state.map.grid) {
                    console.log("Old save format detected. Resetting.");
                    this.initNewGame();
                    return;
                }

                // Restore Map
                this.map = new GameMap();
                this.map.width = state.map.width;
                this.map.height = state.map.height;
                this.map.grid = state.map.grid;
                this.map.rooms = state.map.rooms || [];
                this.map.explored = state.map.explored;

                // Rehydrate Entities
                this.map.entities = state.map.entities.map(e => {
                    if (e.type === 'monster') {
                        const m = new Monster(e.x, e.y, e.monsterType || 'skeleton'); // fallback
                        m.life = e.life;
                        m.id = e.id;
                        if (e.originX !== undefined) {
                            m.originX = e.originX;
                            m.originY = e.originY;
                        }
                        return m;
                    } else if (e.type === 'item') {
                        const i = new Item(e.x, e.y, e.itemType);
                        i.value = e.value;
                        i.id = e.id;
                        return i;
                    }
                    return null;
                }).filter(e => e !== null);


                // Rehydrate Player
                const savedClass = state.player.classKey || 'warrior';
                this.player = new Player(state.player.x, state.player.y, savedClass);
                this.player.life = state.player.life;
                // MIGRATION: Hunger -> Stamina
                this.player.stamina = state.player.stamina !== undefined ? state.player.stamina : (state.player.hunger || 100);
                this.player.maxStamina = 100; // Reset max to be sure

                // MIGRATION: Old saves have 'power', new needs 'basePower'
                this.player.basePower = state.player.basePower !== undefined ? state.player.basePower : (state.player.power || 10);

                this.player.inventory = state.player.inventory;
                this.player.equipment = state.player.equipment || this.player.equipment; // Load equip if exists

                this.player.xp = state.player.xp || 0;
                this.player.level = state.player.level || 1;
                this.player.nextLevelXp = state.player.nextLevelXp || 50;
                if (state.player.maxLife) this.player.maxLife = state.player.maxLife;

                this.depth = state.depth || 1;

                this.ui.log("Game Loaded.", "info");

            } catch (err) {
                console.error("Save file corrupted, starting new.", err);
                this.initNewGame();
            }
        } else {
            // No save found. Do not Init. Wait for Start().
            console.log("No save found. Waiting for Welcome Screen.");
        }
    }

    initNewGame(classKey = 'warrior') {
        this.depth = 1;
        // Create player briefly so we have the object, but coordinates will be set by setupLevel
        this.player = new Player(0, 0, classKey);
        this.setupLevel();
        this.ui.log(`New Game Started as ${this.player.name}.`, "good");
        this.saveGame();
        this.render();
    }

    nextLevel() {
        this.depth++;
        this.ui.log(`You descend to level ${this.depth}...`, "good");
        this.player.heal(10);

        this.setupLevel();
        this.saveGame();
        this.render();
    }

    setupLevel() {
        // Dynamic Map Size based on Viewport
        // Measure the container directly!
        const viewport = document.querySelector('.viewport-container');
        let availW = window.innerWidth - 320; // Fallback
        let availH = window.innerHeight - 50;

        if (viewport) {
            availW = viewport.clientWidth;
            availH = viewport.clientHeight;
        }

        // Compute tiles based on ~32px sizing
        // We floor it to ensure it fits
        let cols = Math.floor(availW / 32);
        let rows = Math.floor(availH / 32);

        // Ensure minimum playability, but NO MAX limit (fill the screen!)
        cols = Math.max(20, cols);
        rows = Math.max(15, rows);

        // Pad slightly to avoid edge gluing
        cols -= 2;
        rows -= 2;

        this.map = new GameMap(cols, rows);
        this.ui.initGrid(cols, rows); // Ensure UI matches Map dimensions!

        const rooms = this.map.rooms;

        if (!rooms || rooms.length === 0) return;

        const startPos = this.map.getCenter(rooms[0]);
        this.player.x = startPos.x;
        this.player.y = startPos.y;

        // 2. Stairs spawn in the last room center
        const endPos = this.map.getCenter(rooms[rooms.length - 1]);
        this.map.addEntity(new Item(endPos.x, endPos.y, 'exit'));

        // 3. Spawn Monsters & Items in other rooms
        // Skip first room for monsters to give player a safe start
        for (let i = 1; i < rooms.length; i++) {
            const room = rooms[i];
            const center = this.map.getCenter(room);

            // Chance for Monster
            // DEBUG: 100% chance
            // Chance for Monster
            // 1-3 Monsters per room
            // DEBUG: 100% chance for at least 1, but let's make it robust
            if (Math.random() < 1.0) {
                // 1-3 Monsters per room
                const monsterCount = Math.floor(Math.random() * 3) + 1; // 1, 2, or 3

                // console.log(`DEBUG: Spawning ${monsterCount} monsters in room ${i}`); 

                for (let k = 0; k < monsterCount; k++) {
                    const roll = Math.random();
                    let type = 'spider';
                    if (roll < 0.1) type = 'deamon';
                    else if (roll < 0.25) type = 'blob';
                    else if (roll < 0.45) type = 'zombie';
                    else if (roll < 0.7) type = 'skeleton';

                    // Retry to find a valid spot
                    let placed = false;
                    for (let attempt = 0; attempt < 20; attempt++) {
                        const rx = Math.floor(Math.random() * room.w) + room.x;
                        const ry = Math.floor(Math.random() * room.h) + room.y;

                        if (!this.map.isWall(rx, ry) && !this.map.getEntityAt(rx, ry) && (rx !== this.player.x || ry !== this.player.y)) {
                            this.map.addEntity(new Monster(rx, ry, type, this.depth));
                            placed = true;
                            break;
                        }
                    }
                }
            }

            // Chance for Treasure
            // DEBUG: 100% chance
            if (Math.random() < 1.0) {
                const rx = Math.floor(Math.random() * room.w) + room.x;
                const ry = Math.floor(Math.random() * room.h) + room.y;
                if (!this.map.isWall(rx, ry) && !this.map.getEntityAt(rx, ry)) {
                    this.map.addEntity(new Item(rx, ry, 'treasure'));
                }
            }
        }
    }

    // ---------------- LOGIC ---------------- //

    handleInput(e) {
        if (!this.player || !this.player.isAlive()) return;

        let dx = 0;
        let dy = 0;

        switch (e.key) {
            case 'ArrowUp': dy = -1; break;
            case 'ArrowDown': dy = 1; break;
            case 'ArrowLeft': dx = -1; break;
            case 'ArrowRight': dx = 1; break;
            default: return; // Ignore other keys
        }

        e.preventDefault();
        this.movePlayer(dx, dy);
    }

    movePlayer(dx, dy) {
        this.engagedMonsters = new Set(); // Reset per turn

        // DEBUG: Log monsters around the player at the start of the turn
        const allMonsters = this.map.entities.filter(e => e.type === 'monster' && e.isAlive());
        const nearbyMonsters = allMonsters.filter(m => {
            const dxm = Math.abs(m.x - this.player.x);
            const dym = Math.abs(m.y - this.player.y);
            return dxm <= 1 && dym <= 1; // 8 neighbours + current tile
        });
        console.log("DEBUG: Start of turn - total monsters:", allMonsters.length,
            "nearby monsters:", nearbyMonsters.map(m => ({
                id: m.id,
                type: m.monsterType,
                x: m.x,
                y: m.y,
                life: m.life
            })));

        // Tick Paralysis at start of turn (before movement check)
        const wasParalyzed = this.player.isParalyzed();
        if (this.player.tickParalysis()) {
            this.ui.log("You can move again.", "info");
        }

        const newX = this.player.x + dx;
        const newY = this.player.y + dy;

        // 1. Check Bounds & Walls
        if (this.map.isWall(newX, newY)) {
            this.ui.log("Blocked by a wall.", "info");
            return;
        }

        // 2. Check Entities
        const target = this.map.getEntityAt(newX, newY);

        if (target) {
            if (target.type === 'monster') {
                console.log("DEBUG: Player is attacking monster:", {
                    id: target.id,
                    type: target.monsterType,
                    name: target.name,
                    x: target.x,
                    y: target.y,
                    life: target.life
                });

                this.triggerCombat(target);
                // Combat takes movement point? Yes usually.
                // But hunger? Let's say yes.
                this.processStamina();

                // Allow monster to fight back (other monsters, or this one if it survived and wasn't engaged?)
                // triggerCombat adds to engagedMonsters.
                // processMonsterTurns skips engagedMonsters.
                // So this logic is safe.
                console.log("DEBUG: After combat, before monster turns - monsters alive:", this.map.entities.filter(e => e.type === 'monster' && e.isAlive()).length);
                this.processMonsterTurns();
                console.log("DEBUG: After monster turns - monsters alive:", this.map.entities.filter(e => e.type === 'monster' && e.isAlive()).length);

                this.render();
                return; // Don't move into monster
            } else if (target.type === 'item') {
                if (target.itemType === 'exit') {
                    this.nextLevel();
                    return;
                }
                this.collectItem(target);
                // Move into item tile
            }
        }

        // 3. Check if player is STILL paralyzed (after tick) - can attack but can't move
        if (wasParalyzed && this.player.isParalyzed()) {
            this.ui.log("You are paralyzed and cannot move!", "warning");
            this.processMonsterTurns();
            this.render();
            this.saveGame();
            return;
        }

        // 4. Move
        this.player.x = newX;
        this.player.y = newY;

        // Tick Buffs
        if (this.player.tickBuffs()) {
            this.ui.log("Your invulnerability has faded.", "info");
        }

        this.processStamina();

        // Monster Turn
        this.processMonsterTurns();

        this.render();
        this.saveGame();
    }

    processMonsterTurns() {
        const pRoom = this.map.getRoomAt(this.player.x, this.player.y);

        const activeMonsters = this.map.entities.filter(e =>
            e.type === 'monster' && e.isAlive()
        );

        activeMonsters.forEach(monster => {
            const mRoom = this.map.getRoomAt(monster.x, monster.y);

            // Blob slow movement - only moves every other turn
            if (monster.isSlow) {
                monster.turnCounter = (monster.turnCounter || 0) + 1;
                if (monster.turnCounter % 2 !== 0) {
                    return; // Skip this turn
                }
            }

            // Logic:
            const dx = Math.abs(this.player.x - monster.x);
            const dy = Math.abs(this.player.y - monster.y);
            const dist = dx + dy;

            // Chase if within aggro range (allows following into corridors)
            const AGGRO_RANGE = 8;

            if (dist <= AGGRO_RANGE) {
                // Check if already updated this turn (engaged)
                if (this.engagedMonsters && this.engagedMonsters.has(monster.id)) return;

                this.moveMonsterTowardsPlayer(monster);
            }
        });
    }

    moveMonsterTowardsPlayer(monster) {
        const dx = this.player.x - monster.x;
        const dy = this.player.y - monster.y;

        // Smart Pathfinding: Try primary axis, then secondary axis
        const moves = [];

        if (Math.abs(dx) >= Math.abs(dy)) {
            // Primary X
            if (dx !== 0) moves.push({ x: Math.sign(dx), y: 0 });
            if (dy !== 0) moves.push({ x: 0, y: Math.sign(dy) });
        } else {
            // Primary Y
            if (dy !== 0) moves.push({ x: 0, y: Math.sign(dy) });
            if (dx !== 0) moves.push({ x: Math.sign(dx), y: 0 }); // Fallback
        }

        for (let move of moves) {
            const destX = monster.x + move.x;
            const destY = monster.y + move.y;

            // Check Leash (Max 8 blocks from origin)
            // Use originX/Y if available, else fallback to start (though constructor ensures origin is set)
            if (monster.originX !== undefined) {
                const distFromOrigin = Math.abs(destX - monster.originX) + Math.abs(destY - monster.originY);
                // Allow attack even if target is outside leash (monster doesn't move when attacking)
                const isAttack = (destX === this.player.x && destY === this.player.y);

                if (distFromOrigin > 8 && !isAttack) {
                    continue; // Skip this move, it pulls too far from home
                }
            }

            // If move succeeded (moved or attacked), stop.
            if (this.tryMonsterMove(monster, destX, destY)) {
                return;
            }
        }
    }

    tryMonsterMove(monster, x, y) {
        // 1. Check Collision with Player -> ATTACK
        if (x === this.player.x && y === this.player.y) {
            this.triggerCombat(monster);
            return true; // Action taken
        }

        // 2. Check Walls & Other Entities
        if (this.map.isWall(x, y) || this.map.getEntityAt(x, y)) {
            return false; // Blocked, try next move
        }

        // 3. Move
        monster.x = x;
        monster.y = y;
        return true; // Moved
    }

    triggerCombat(monster) {
        if (this.engagedMonsters.has(monster.id)) return;
        this.engagedMonsters.add(monster.id);

        // DEBUG: Snapshot of monsters right before this combat
        const monstersBefore = this.map.entities.filter(e => e.type === 'monster' && e.isAlive());
        console.log("DEBUG: triggerCombat - starting combat with monster", {
            id: monster.id,
            type: monster.monsterType,
            name: monster.name,
            x: monster.x,
            y: monster.y,
            life: monster.life
        }, "Total monsters alive:", monstersBefore.length);

        const staminaRatio = this.player.stamina / this.player.maxStamina;
        const chance = Math.floor(staminaRatio * 100);
        const roll = Math.floor(Math.random() * 100); // 0-99

        console.log(`DEBUG: Initiative Roll: ${roll} vs Chance: ${chance}`);

        // Player wins if roll < chance
        const playerFirst = roll < chance;

        if (playerFirst) {
            this.ui.log(`Initiative: You won! (Roll: ${roll} < ${chance}%)`, "info");
            this.ui.log("You strike first!", "info");
            this.performAttack(this.player, monster);
            if (monster.isAlive()) {
                this.performAttack(monster, this.player);
            }
        } else {
            this.ui.log(`Initiative: Monster won! (Roll: ${roll} >= ${chance}%)`, "warning");
            this.ui.log(`The ${monster.name} strikes first!`, "warning");
            this.performAttack(monster, this.player);
            if (this.player.isAlive() && monster.isAlive()) {
                this.performAttack(this.player, monster);
            }
        }

        // DEBUG: Snapshot of monsters right after this combat resolution
        const monstersAfter = this.map.entities.filter(e => e.type === 'monster' && e.isAlive());
        console.log("DEBUG: triggerCombat - combat resolved. Total monsters alive now:", monstersAfter.length);
    }

    performAttack(attacker, defender) {
        let damage = attacker.power;

        // If attacker is paralyzed player, deal no damage
        if (attacker === this.player && this.player.isParalyzed()) {
            damage = 0;
            this.ui.log("You swing weakly while paralyzed - no damage!", "warning");
        }

        if (attacker === this.player) {
            const beforeLife = defender.life;
            defender.takeDamage(damage);
            if (damage > 0) {
                this.ui.log(`You hit the ${defender.name} for ${damage} damage!`, "combat");
            }

            console.log("DEBUG: performAttack (player) -> defender state", {
                defenderId: defender.id,
                name: defender.name,
                type: defender.monsterType,
                beforeLife,
                damage,
                afterLife: defender.life,
                isAlive: defender.isAlive()
            });

            if (!defender.isAlive()) {
                this.handleMonsterDeath(defender);
            }
        } else {
            if (this.player.isInvulnerable()) {
                this.ui.log(`The ${attacker.name} attacks, but you are INVULNERABLE!`, "combat");
            } else {
                this.ui.log(`The ${attacker.name} hits you for ${damage} damage!`, "combat");
                this.player.takeDamage(damage);

                // Blob paralysis effect - 50% chance
                if (attacker.paralysisChance && Math.random() < attacker.paralysisChance) {
                    this.player.addParalysis(1);
                    this.ui.log(`The ${attacker.name}'s slime paralyzes you!`, "bad");
                }

                if (!this.player.isAlive()) {
                    this.death(`Killed by a ${attacker.name}`);
                }
            }
        }
    }

    handleMonsterDeath(monster) {
        const monstersBefore = this.map.entities.filter(e => e.type === 'monster' && e.isAlive());
        console.log("DEBUG: handleMonsterDeath called for", {
            id: monster.id,
            type: monster.monsterType,
            name: monster.name,
            x: monster.x,
            y: monster.y,
            life: monster.life
        }, "Monsters alive before removal:", monstersBefore.length);

        this.ui.log(`The ${monster.name} dies!`, "good");

        // XP Calculation
        const maxLife = monster.maxLife || 20;
        const xpGain = Math.floor(monster.power + (0.20 * maxLife));

        this.ui.log(`Gained ${xpGain} XP.`, "good");

        const oldLevel = this.player.level;
        this.player.gainXp(xpGain);
        if (this.player.level > oldLevel) {
            this.ui.log(`LEVEL UP! You are now level ${this.player.level}!`, "loot");
        }

        // Drops
        if (Math.random() < 1.0) {
            let drop;
            if (monster.monsterType === 'deamon') {
                drop = new Item(0, 0, 'gem');
            } else {
                drop = this.generateLoot();
            }
            this.ui.log(`The monster dropped a ${drop.name || 'loot'}!`, "loot");
            this.player.addToInventory(drop);
        }

        this.map.removeEntity(monster);

        const monstersAfter = this.map.entities.filter(e => e.type === 'monster' && e.isAlive());
        console.log("DEBUG: handleMonsterDeath finished. Monsters alive after removal:", monstersAfter.length);
    }

    collectItem(item) {
        if (item.itemType === 'treasure') {
            this.map.removeEntity(item);

            // Treasure always drops something
            const drops = [];
            // 1-2 items
            const count = Math.random() > 0.5 ? 2 : 1;
            for (let i = 0; i < count; i++) {
                drops.push(this.generateLoot());
            }

            drops.forEach(drop => {
                let msg = "";
                if (drop.itemType === 'gold') {
                    msg = `You found ${drop.value} gold!`;
                } else {
                    msg = `You found a ${drop.name}!`;
                }
                this.ui.log(msg, "loot");
                this.player.addToInventory(drop);
            });
        } else {
            // Pick up normal item
            this.map.removeEntity(item);
            this.ui.log(`You picked up ${item.name}.`, "loot");
            this.player.addToInventory(item);
        }
    }

    generateLoot() {
        const roll = Math.random();
        if (roll < 0.1) {
            return this.createEquipmentDrop();
        } else if (roll < 0.5) {
            return this.createGoldDrop();
        } else if (roll < 0.8) {
            return new Item(0, 0, 'food');
        } else {
            return new Item(0, 0, 'potion');
        }
    }

    createEquipmentDrop() {
        const slots = ['head', 'chest', 'l_arm', 'r_arm', 'l_weapon', 'r_weapon', 'pubis', 'l_leg', 'r_leg', 'l_shoe', 'r_shoe'];
        const slot = slots[Math.floor(Math.random() * slots.length)];

        const item = new Item(0, 0, 'equipment');
        item.slot = slot;
        item.value = 1; // +1 Power

        // Flavor text
        const names = {
            head: 'Helmet', chest: 'Armor', l_arm: 'Gauntlet', r_arm: 'Gauntlet',
            l_weapon: 'Sword', r_weapon: 'Dagger', pubis: 'Loincloth',
            l_leg: 'Greave', r_leg: 'Greave', l_shoe: 'Boot', r_shoe: 'Boot'
        };
        const icons = {
            head: '🪖', chest: '🥋', l_arm: '🧤', r_arm: '🧤',
            l_weapon: '🗡️', r_weapon: '🔪', pubis: '🩲',
            l_leg: '🦵', r_leg: '🦵', l_shoe: '👢', r_shoe: '👢'
        };

        item.name = names[slot] || 'Gear';
        item.symbol = icons[slot] || '🛡️';

        return item;
    }

    createGoldDrop() {
        const gold = new Item(0, 0, 'gold');
        gold.value = Math.floor(Math.random() * 50) + 10;
        return gold;
    }

    processStamina() {
        if (this.player.isInvulnerable()) return; // No stamina loss while invulnerable

        this.player.decreaseStamina(1);
        if (this.player.stamina <= 0) {
            this.ui.log("You are collapsing from FATIGUE!", "bad");
            this.player.takeDamage(1); // Fatigue damage
            if (!this.player.isAlive()) this.death("You died from exhaustion.");
        }
    }

    death(cause) {
        this.ui.log("You have died.", "combat");
        this.render();
        this.saveGame(); // Save death state
        this.ui.showGameOver(cause || "You were slain in the dungeon.", () => this.resetGame());
    }

    useItem(item) {
        if (item.itemType === 'food') {
            this.ui.log(`You ate a ${item.name} and recovered ${item.value} stamina.`, "good");
            this.player.eat(item.value);
            item.quantity--;
            if (item.quantity <= 0) {
                this.player.inventory = this.player.inventory.filter(i => i !== item);
            }
            this.render();
            this.saveGame();
        } else if (item.itemType === 'potion') {
            this.ui.log(`You drank a ${item.name} and recovered ${item.value} life.`, "good");
            this.player.heal(item.value);
            item.quantity--;
            if (item.quantity <= 0) {
                this.player.inventory = this.player.inventory.filter(i => i !== item);
            }
            this.render();
            this.render();
            this.saveGame();
        } else if (item.itemType === 'gem') {
            this.ui.log(`You used the ${item.name} and feel INVINCIBLE!`, "good");
            this.player.addInvulnerability(item.value);
            item.quantity--;
            if (item.quantity <= 0) {
                this.player.inventory = this.player.inventory.filter(i => i !== item);
            }
            this.render();
            this.saveGame();
        } else if (item.itemType === 'equipment') {
            const current = this.player.equipment[item.slot];

            if (current) {
                // Upgrade Mode: Consume 1 item to boost stats
                const result = this.player.equipItem(item);
                if (result) {
                    this.ui.log(`Upgraded ${result.item.name} to +${result.item.value}!`, "good");

                    item.quantity--;
                    if (item.quantity <= 0) {
                        this.player.inventory = this.player.inventory.filter(i => i !== item);
                    }
                }
            } else {
                // Equip Mode: Move item to slot
                if (item.quantity > 1) {
                    // Split stack: Leave rest in inventory, equip one
                    item.quantity--;

                    // Clone single item
                    const single = new Item(item.x, item.y, item.symbol, item.type);
                    Object.assign(single, item); // Copy props
                    single.quantity = 1;
                    single.id = crypto.randomUUID(); // Unique ID

                    this.player.equipItem(single);
                    this.ui.log(`You equipped ${single.name}.`, "good");
                } else {
                    // Simple move
                    this.player.equipItem(item);
                    this.ui.log(`You equipped ${item.name}.`, "good");
                    this.player.inventory = this.player.inventory.filter(i => i !== item);
                }
            }
            this.render();
            this.saveGame();
        }
    }

    render() {
        const fov = this.computeFOV(this.player.x, this.player.y, 3); // Radius 3
        this.ui.drawMap(this.map, this.player, fov);
        this.ui.updateStats(this.player, this.depth);
        this.ui.updateStatusEffects(this.player);
        this.ui.updateInventory(this.player.inventory, (item) => this.useItem(item));
        this.ui.updateEquipment(this.player);
    }

    computeFOV(x, y, radius) {
        const visibleTiles = new Set();

        // Naive Shadowcasting / Raycasting for small radius
        // We just iterate all distinct cells in square of radius
        // And cast a ray from center to them.
        for (let ry = -radius; ry <= radius; ry++) {
            for (let rx = -radius; rx <= radius; rx++) {
                // If within distance
                if (rx * rx + ry * ry <= radius * radius + 2) { // +2 assumes slight circle smoothing
                    const targetX = x + rx;
                    const targetY = y + ry;

                    // Raycast line
                    const line = this.getLine(x, y, targetX, targetY);

                    for (let point of line) {
                        visibleTiles.add(`${point.x},${point.y}`);
                        this.map.setExplored(point.x, point.y);

                        // If wall, stop *after* adding the wall (you satisfy "blocked by walls")
                        // so you see the wall face, but nothing behind it.
                        if (this.map.isWall(point.x, point.y)) {
                            break;
                        }
                    }
                }
            }
        }
        return visibleTiles;
    }

    // Bresenham's Line Algorithm
    getLine(x0, y0, x1, y1) {
        let points = [];
        let dx = Math.abs(x1 - x0);
        let dy = Math.abs(y1 - y0);
        let sx = (x0 < x1) ? 1 : -1;
        let sy = (y0 < y1) ? 1 : -1;
        let err = dx - dy;

        while (true) {
            points.push({ x: x0, y: y0 });
            if ((x0 === x1) && (y0 === y1)) break;
            let e2 = 2 * err;
            if (e2 > -dy) { err -= dy; x0 += sx; }
            if (e2 < dx) { err += dx; y0 += sy; }
        }
        return points;
    }
}
