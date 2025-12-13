export class Entity {
    constructor(x, y, symbol, type) {
        this.x = x;
        this.y = y;
        this.symbol = symbol;
        this.type = type; // 'player', 'monster', 'item'
        this.id = crypto.randomUUID();
    }
}

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
        return this.basePower + bonus;
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
    constructor(x, y) {
        super(x, y, '🤺', 'player', 'Hero', 100, 10);
        this.maxStamina = 100;
        this.stamina = 100;
        this.inventory = [];
        this.xp = 0;
        this.level = 1;
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
        this.maxLife += 20;
        this.life = this.maxLife;
        this.basePower += 3;

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

    decreaseStamina(amount = 1) {
        this.stamina -= amount;
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
        } else if (type === 'deamon') {
            symbol = '👹';
            name = 'Deamon';
            life = 40;
            power = 15;
        }

        // Difficulty Scaling: Increase by 5% per depth level
        // Depth 1 = 1.05x? Or Base?
        // User said: "each time user go deeper... increased by 5%"
        // Let's treat Depth 1 as base stats (scaling factor 1.0)
        // And Depth 2 as 1.05, etc.
        // Formula: 1 + ((depth - 1) * 0.1)
        const multiplier = 1 + ((depth - 1) * 0.1);

        life = Math.floor(life * multiplier);
        power = Math.floor(power * multiplier);

        super(x, y, symbol, 'monster', name, life, power);
        this.monsterType = type;
        this.depth = depth; // Store for reference
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
