export class Entity {
    constructor(x, y, symbol, type) {
        this.x = x;
        this.y = y;
        this.symbol = symbol;
        this.type = type; // 'player', 'monster', 'item'
        this.id = crypto.randomUUID();
    }
}

// Game Configuration
export const CLASSES = {
    warrior: {
        name: "Warrior",
        stats: {
            life: 100,
            maxLife: 100,
            power: 10,
            stamina: 100,
            maxStamina: 100
        },
        perks: {
            lifePerLevel: 20,
            powerPerLevel: 3,
            staminaCost: 1
        },
        description: "A battle-hardened fighter with high durability.",
        image: "./warrior.png" // Image in root
    },
    thief: {
        name: "Thief",
        stats: {
            life: 100,
            maxLife: 100,
            power: 10,
            stamina: 100,
            maxStamina: 100
        },
        perks: {
            lifePerLevel: 10,
            powerPerLevel: 5,
            staminaCost: 0.7
        },
        description: "A cunning rogue who moves swiftly but is less durable.",
        image: "./thief.png"
    }
};

export class Actor extends Entity {
    constructor(x, y, symbol, type, name, life, power) {
        super(x, y, symbol, type);
        this.name = name;
        this.maxLife = life;
        this.life = life;
        this.basePower = power;
    }

    get power() {
        let bonus = 0;
        if (this.equipment) {
            Object.values(this.equipment).forEach(item => {
                if (item && item.value) bonus += item.value;
            });
        }
        let totalPower = this.basePower + bonus;

        // Apply pox debuff - halves power
        if (this.isPoxed && this.isPoxed()) {
            totalPower = Math.floor(totalPower / 2);
        }

        return totalPower;
    }

    set power(val) {
        this.basePower = val; // For compatibility/simple setting
    }

    isAlive() {
        return this.life > 0;
    }

    takeDamage(amount) {
        this.life -= amount;
        if (this.life < 0) this.life = 0;
    }

    heal(amount) {
        this.life += amount;
        if (this.life > this.maxLife) this.life = this.maxLife;
    }
}

export class Player extends Actor {
    constructor(x, y, classKey = 'warrior') {
        const charClass = CLASSES[classKey] || CLASSES['warrior'];
        const stats = charClass.stats;

        // Call super first!
        super(x, y, '🤺', 'player', charClass.name, stats.life, stats.power);

        this.classKey = classKey;
        this.perks = charClass.perks;

        this.maxStamina = stats.maxStamina;

        this.inventory = [];
        this.xp = 0;
        this.level = 1;
        this.nextLevelXp = 50;

        // Equipment Slots
        this.equipment = {
            head: null,
            chest: null,
            l_arm: null,
            r_arm: null,
            l_weapon: null,
            r_weapon: null,
            pubis: null,
            l_leg: null,
            r_leg: null,
            l_shoe: null,
            r_shoe: null
        };
    }

    gainXp(amount) {
        this.xp += amount;
        if (this.xp >= this.nextLevelXp) {
            this.levelUp();
        }
    }

    levelUp() {
        this.xp -= this.nextLevelXp;
        this.level++;
        this.nextLevelXp = Math.floor(this.nextLevelXp * 1.5);

        // Stat Boosts
        // Stat Boosts
        const lifeGain = this.perks ? this.perks.lifePerLevel : 20;
        const powerGain = this.perks ? this.perks.powerPerLevel : 3;

        this.maxLife += lifeGain;
        this.life = this.maxLife;
        this.basePower += powerGain;

        return true;
        return true;
    }

    takeDamage(amount) {
        if (this.isInvulnerable()) {
            return;
        }
        super.takeDamage(amount);
    }

    // New: Invulnerability Logic
    addInvulnerability(turns) {
        this.invulnerableTurns = (this.invulnerableTurns || 0) + turns;
    }

    tickBuffs() {
        if (this.invulnerableTurns > 0) {
            this.invulnerableTurns--;
            return this.invulnerableTurns === 0; // Return true if it JUST expired
        }
        return false;
    }

    isInvulnerable() {
        return this.invulnerableTurns > 0;
    }

    // Paralysis Logic
    addParalysis(turns) {
        this.paralyzedTurns = (this.paralyzedTurns || 0) + turns;
    }

    tickParalysis() {
        if (this.paralyzedTurns > 0) {
            this.paralyzedTurns--;
            return this.paralyzedTurns === 0; // Return true if it JUST expired
        }
        return false;
    }

    isParalyzed() {
        return this.paralyzedTurns > 0;
    }

    // Pox Logic
    addPox(turns) {
        this.poxedTurns = (this.poxedTurns || 0) + turns;
    }

    tickPox() {
        if (this.poxedTurns > 0) {
            this.poxedTurns--;
            return this.poxedTurns === 0;
        }
        return false;
    }

    isPoxed() {
        return this.poxedTurns > 0;
    }

    decreaseStamina(amount = 1) {
        // Use perk cost if available (default to 1 if not)
        const cost = this.perks ? (this.perks.staminaCost * amount) : amount;
        this.stamina -= cost;
        if (this.stamina < 0) this.stamina = 0;
    }

    eat(amount) {
        this.stamina += amount;
        if (this.stamina > this.maxStamina) this.stamina = this.maxStamina;
    }

    addToInventory(newItem) {
        const existing = this.inventory.find(i => i.itemType === newItem.itemType && i.name === newItem.name);
        if (existing) {
            if (newItem.itemType === 'gold') {
                existing.value += newItem.value;
            } else {
                existing.quantity += newItem.quantity;
            }
        } else {
            this.inventory.push(newItem);
        }
        console.log("DEBUG: Inventory size:", this.inventory.length);
    }

    equipItem(item) {
        if (item.itemType !== 'equipment') return null;

        const slot = item.slot;
        const currentEquip = this.equipment[slot];

        if (currentEquip) {
            // CUMULATIVE LOGIC: Add value to existing item
            currentEquip.value += item.value;
            return { action: 'upgraded', item: currentEquip };
        } else {
            // Equip new if empty
            this.equipment[slot] = item;
            return { action: 'equipped', item: item };
        }
    }
}

export class Monster extends Actor {
    constructor(x, y, type, depth = 1) {
        // Stats based on type
        let symbol = '👾';
        let name = 'Unknown';
        let life = 10;
        let power = 2;

        if (type === 'skeleton') {
            symbol = '💀';
            name = 'Skeleton';
            life = 22;
            power = 10;
        } else if (type === 'spider') {
            symbol = '🕷️';
            name = 'Giant Spider';
            life = 20;
            life = 20;
            power = 3;
        } else if (type === 'zombie') {
            symbol = '🧟';
            name = 'Zombie';
            life = 35;
            power = 5;
        } else if (type === 'blob') {
            symbol = '🧊';
            name = 'Blob';
            life = 40;
            power = 5;
        } else if (type === 'deamon') {
            symbol = '👹';
            name = 'Deamon';
            life = 40;
            power = 15;
        } else if (type === 'rat') {
            symbol = '🐀';
            name = 'Rat';
            life = 15;
            power = 5;
        }

        // Difficulty Scaling: Monsters get stronger with depth
        // Depth 1 starts at 1x base stats
        // Each additional depth adds 15% more
        // Formula: 1 + ((depth - 1) * 0.15)
        const multiplier = 1 + ((depth - 1) * 0.15);

        life = Math.floor(life * multiplier);
        power = Math.floor(power * multiplier);

        super(x, y, symbol, 'monster', name, life, power);
        this.monsterType = type;
        this.depth = depth; // Store for reference
        this.originX = x;
        this.originY = y;

        // Special blob properties
        if (type === 'blob') {
            this.isSlow = true; // Moves every other turn
            this.turnCounter = 0;
            this.paralysisChance = 0.25; // 25% chance to paralyze on hit
        }

        // Special rat properties
        if (type === 'rat') {
            this.hasInitiative = true; // Always wins initiative
            this.poxChance = 0.20; // 20% chance to apply pox on hit
        }
    }
}

export class Item extends Entity {
    constructor(x, y, type) {
        let symbol = '📦';
        let name = 'Item';
        let value = 0;

        if (type === 'treasure') {
            symbol = '💰';
            name = 'Treasure';
        } else if (type === 'food') {
            symbol = '🍖';
            name = 'Ration';
            value = 20; // Nutrition
        } else if (type === 'gold') {
            symbol = '🪙';
            name = 'Gold';
        } else if (type === 'exit') {
            symbol = '🪜';
            name = 'Stairs down';
        } else if (type === 'potion') {
            symbol = '🧪';
            name = 'Health Potion';
            symbol = '🧪';
            name = 'Health Potion';
            value = 30; // Healing amount
        } else if (type === 'gem') {
            symbol = '💎';
            name = 'Invulnerability Gem';
            value = 30; // Turns
        } else if (type === 'equipment') {
            symbol = '🛡️'; // Default, overwritten by factory
            name = 'Gear';
            value = 1; // Power bonus
            // slot must be assigned manually or by factory
        }

        super(x, y, symbol, 'item');
        this.itemType = type;
        this.name = name;
        this.value = value;
        this.quantity = 1;
    }
}
