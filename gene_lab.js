import * as THREE from 'three';
import { GeneEngine } from './gene_engine.js';

export class GeneLab extends GeneEngine {
    setBallColor(ball, color) {
        ball.material.color.set(color);
        ball.material.emissive.set(color);
    }

    addChromosome(pattern, color, x = 0, y = 0, z = 0) {
        const numBalls = (pattern.match(/o/g) || []).length;
        z = numBalls - 9;
        const balls = [];
        let currentBall = this.addBall(x, y, z, color);
        balls.push(currentBall);

        let i = 1;
        while (i < pattern.length) {
            if (pattern[i] === '-' && pattern[i + 1] === 'o') {
                currentBall = this.addStickBall(currentBall);
                balls.push(currentBall);
                i += 2;
            } else if (pattern[i] === 'o') {
                currentBall = this.addConnectedBall(currentBall);
                balls.push(currentBall);
                i++;
            } else {
                i++;
            }
        }

        const chromosome = {
            balls: balls,
            pattern: pattern,
            color: color
        };

        return chromosome;
    }

    async duplicateChromosome(chromosome, offsetX = 3, offsetY = 0, offsetZ = 0, delay = 100) {
        const newBalls = [];
        const pattern = chromosome.pattern;
        const color = chromosome.color;

        const firstBall = chromosome.balls[0];
        const newFirst = this.popBall(
            firstBall.position.x + offsetX,
            firstBall.position.y + offsetY,
            firstBall.position.z + offsetZ,
            color
        );
        newBalls.push(newFirst);

        await new Promise(resolve => setTimeout(resolve, delay));

        let currentBall = newFirst;
        let ballIndex = 1;
        let i = 1;

        while (i < pattern.length) {
            if (pattern[i] === '-' && pattern[i + 1] === 'o') {
                currentBall = await this.popStickBall(currentBall, 0);
                newBalls.push(currentBall);
                i += 2;
                ballIndex++;
            } else if (pattern[i] === 'o') {
                currentBall = await new Promise((resolve) => {
                    setTimeout(() => {
                        const child = this.popBall(
                            currentBall.position.x,
                            currentBall.position.y - 2,
                            currentBall.position.z,
                            color
                        );

                        const dx = child.position.x - currentBall.position.x;
                        const dy = child.position.y - currentBall.position.y;
                        const dz = child.position.z - currentBall.position.z;
                        const restLength = Math.sqrt(dx * dx + dy * dy + dz * dz);

                        this.connections.push({
                            parent: currentBall,
                            child: child,
                            restLength: restLength,
                            line: null
                        });

                        resolve(child);
                    }, 0);
                });
                newBalls.push(currentBall);
                i++;
                ballIndex++;
            } else {
                i++;
            }

            await new Promise(resolve => setTimeout(resolve, delay));
        }

        return {
            balls: newBalls,
            pattern: pattern,
            color: color
        };
    }

    async formTetrad(chromo1, chromo2, spacing = 0.5, duration = 2000) {
        const startTime = Date.now();

        const initialPositions1 = chromo1.balls.map(ball => ({
            x: ball.position.x,
            y: ball.position.y,
            z: ball.position.z
        }));

        const initialPositions2 = chromo2.balls.map(ball => ({
            x: ball.position.x,
            y: ball.position.y,
            z: ball.position.z
        }));

        const centerX = (initialPositions1[0].x + initialPositions2[0].x) / 2;

        chromo1.balls.forEach(ball => ball.userData.pinned = true);
        chromo2.balls.forEach(ball => ball.userData.pinned = true);

        return new Promise((resolve) => {
            const animate = () => {
                const elapsed = Date.now() - startTime;
                const progress = Math.min(elapsed / duration, 1);
                const eased = this.easeInOutCubic(progress);

                chromo1.balls.forEach((ball, i) => {
                    const initial = initialPositions1[i];
                    const targetX = centerX - spacing;
                    ball.position.x = initial.x + (targetX - initial.x) * eased;
                    ball.userData.oldX = ball.position.x;
                });

                chromo2.balls.forEach((ball, i) => {
                    const initial = initialPositions2[i];
                    const targetX = centerX + spacing;
                    ball.position.x = initial.x + (targetX - initial.x) * eased;
                    ball.userData.oldX = ball.position.x;
                });

                if (progress < 1) {
                    requestAnimationFrame(animate);
                } else {
                    chromo1.balls.forEach(ball => ball.userData.pinned = false);
                    chromo2.balls.forEach(ball => ball.userData.pinned = false);
                    resolve();
                }
            };

            animate();
        });
    }

    easeInOutCubic(x) {
        return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
    }

    async crossoverTetrad(sistersA, sistersB, duration = 2000) {
        const diagonal = Math.random() < 0.5;
        const chromoA = diagonal ? sistersA[0] : sistersA[1];
        const chromoB = diagonal ? sistersB[1] : sistersB[0];

        const len = Math.min(chromoA.balls.length, chromoB.balls.length);
        const centromereIndex = chromoA.balls.findIndex(ball =>
            this.connections.some(c => c.child === ball && c.line !== null)
        );

        const validPoints = [];
        for (let i = 1; i < centromereIndex; i++) validPoints.push(i);
        for (let i = centromereIndex + 1; i < len - 1; i++) validPoints.push(i);
        if (validPoints.length === 0) return;

        const crossoverIndex = validPoints[Math.floor(Math.random() * validPoints.length)];
        const aboveCentromere = crossoverIndex < centromereIndex;

        let tailA, tailB, headA, headB;
        if (aboveCentromere) {
            tailA = chromoA.balls.slice(0, crossoverIndex);
            tailB = chromoB.balls.slice(0, crossoverIndex);
            headA = chromoA.balls.slice(crossoverIndex);
            headB = chromoB.balls.slice(crossoverIndex);
        } else {
            tailA = chromoA.balls.slice(crossoverIndex);
            tailB = chromoB.balls.slice(crossoverIndex);
            headA = chromoA.balls.slice(0, crossoverIndex);
            headB = chromoB.balls.slice(0, crossoverIndex);
        }

        const allBalls = [...sistersA, ...sistersB].flatMap(c => c.balls);
        allBalls.forEach(b => {
            b.userData.pinned = true;
            if (b.userData.tetradPos) {
                b.position.x = b.userData.tetradPos.x;
                b.position.y = b.userData.tetradPos.y;
                b.position.z = b.userData.tetradPos.z;
                b.userData.oldX = b.position.x;
                b.userData.oldY = b.position.y;
                b.userData.oldZ = b.position.z;
            }
        });

        const initA = tailA.map(b => ({ x: b.position.x, y: b.position.y, z: b.position.z }));
        const initB = tailB.map(b => ({ x: b.position.x, y: b.position.y, z: b.position.z }));

        return new Promise((resolve) => {
            const startTime = Date.now();
            const animate = () => {
                const elapsed = Date.now() - startTime;
                const progress = Math.min(elapsed / duration, 1);
                const eased = this.easeInOutCubic(progress);

                tailA.forEach((ball, i) => {
                    ball.position.x = initA[i].x + (initB[i].x - initA[i].x) * eased;
                    ball.position.y = initA[i].y + (initB[i].y - initA[i].y) * eased;
                    ball.position.z = initA[i].z + (initB[i].z - initA[i].z) * eased;
                    ball.userData.oldX = ball.position.x;
                    ball.userData.oldY = ball.position.y;
                    ball.userData.oldZ = ball.position.z;
                });

                tailB.forEach((ball, i) => {
                    ball.position.x = initB[i].x + (initA[i].x - initB[i].x) * eased;
                    ball.position.y = initB[i].y + (initA[i].y - initB[i].y) * eased;
                    ball.position.z = initB[i].z + (initA[i].z - initB[i].z) * eased;
                    ball.userData.oldX = ball.position.x;
                    ball.userData.oldY = ball.position.y;
                    ball.userData.oldZ = ball.position.z;
                });

                if (progress < 1) {
                    requestAnimationFrame(animate);
                } else {
                    if (aboveCentromere) {
                        const connA = this.connections.find(c =>
                            c.parent === chromoA.balls[crossoverIndex - 1] &&
                            c.child === chromoA.balls[crossoverIndex]
                        );
                        const connB = this.connections.find(c =>
                            c.parent === chromoB.balls[crossoverIndex - 1] &&
                            c.child === chromoB.balls[crossoverIndex]
                        );
                        if (connA) connA.parent = chromoB.balls[crossoverIndex - 1];
                        if (connB) connB.parent = chromoA.balls[crossoverIndex - 1];
                        chromoA.balls = [...tailB, ...headA];
                        chromoB.balls = [...tailA, ...headB];
                    } else {
                        const connA = this.connections.find(c =>
                            c.parent === chromoA.balls[crossoverIndex - 1] &&
                            c.child === chromoA.balls[crossoverIndex]
                        );
                        const connB = this.connections.find(c =>
                            c.parent === chromoB.balls[crossoverIndex - 1] &&
                            c.child === chromoB.balls[crossoverIndex]
                        );
                        if (connA) connA.child = chromoB.balls[crossoverIndex];
                        if (connB) connB.child = chromoA.balls[crossoverIndex];
                        chromoA.balls = [...headA, ...tailB];
                        chromoB.balls = [...headB, ...tailA];
                    }

                    allBalls.forEach(b => b.userData.pinned = false);
                    resolve();
                }
            };
            animate();
        });
    }

    findStickBall(chromosome) {
        for (let ball of chromosome.balls) {
            const connection = this.connections.find(conn =>
                (conn.parent === ball || conn.child === ball) && conn.line !== null
            );
            if (connection) {
                return connection.parent;
            }
        }
        return chromosome.balls[0];
    }

    async formTetrad4(chromo1, chromo2, chromo3, chromo4, spacing = 3, duration = 2000) {
        const chromos = [chromo1, chromo2, chromo3, chromo4];
        const stickBalls = chromos.map(c => this.findStickBall(c));

        const initials = chromos.map(c => c.balls.map(ball => ({
            x: ball.position.x, y: ball.position.y, z: ball.position.z
        })));

        const stickInitials = stickBalls.map(sb => ({ x: sb.position.x, y: sb.position.y, z: sb.position.z }));

        const centerX = stickInitials.reduce((s, p) => s + p.x, 0) / 4;
        const centerY = stickInitials.reduce((s, p) => s + p.y, 0) / 4;
        const centerZ = stickInitials.reduce((s, p) => s + p.z, 0) / 4;
        const zSpread = spacing;

        const targets = [
            { x: centerX - spacing * 0.5, y: centerY, z: centerZ - zSpread * 0.5 },
            { x: centerX + spacing * 0.5, y: centerY, z: centerZ - zSpread * 0.5 },
            { x: centerX - spacing * 0.5, y: centerY, z: centerZ + zSpread * 0.5 },
            { x: centerX + spacing * 0.5, y: centerY, z: centerZ + zSpread * 0.5 },
        ];

        chromos.forEach(c => c.balls.forEach(ball => ball.userData.pinned = true));

        return new Promise((resolve) => {
            const startTime = Date.now();
            const animate = () => {
                const elapsed = Date.now() - startTime;
                const progress = Math.min(elapsed / duration, 1);
                const eased = this.easeInOutCubic(progress);

                chromos.forEach((chromo, ci) => {
                    const stickInit = stickInitials[ci];
                    const target = targets[ci];
                    const dx = (target.x - stickInit.x) * eased;
                    const dy = (target.y - stickInit.y) * eased;
                    const dz = (target.z - stickInit.z) * eased;

                    chromo.balls.forEach((ball, bi) => {
                        const init = initials[ci][bi];
                        ball.position.x = init.x + dx;
                        ball.position.y = init.y + dy;
                        ball.position.z = init.z + dz;
                        ball.userData.oldX = ball.position.x;
                        ball.userData.oldY = ball.position.y;
                        ball.userData.oldZ = ball.position.z;
                    });
                });

                if (progress < 1) {
                    requestAnimationFrame(animate);
                } else {
                    const tetradId = Date.now();
                    chromos.forEach(c => c.balls.forEach(ball => {
                        ball.userData.pinned = false;
                        ball.userData.tetradId = tetradId;
                        ball.userData.tetradPos = { x: ball.position.x, y: ball.position.y, z: ball.position.z };
                    }));
                    resolve();
                }
            };
            animate();
        });
    }

    addMembrane(chromosomes, padding = 6) {
        const geometry = new THREE.SphereGeometry(1, 32, 32);
        const material = new THREE.MeshPhysicalMaterial({
            color: 0x88bbff,
            transparent: true,
            opacity: 0.12,
            roughness: 0.3,
            metalness: 0.0,
            side: THREE.DoubleSide,
            depthWrite: false,
        });
        const mesh = new THREE.Mesh(geometry, material);
        this.scene.add(mesh);

        const membrane = { mesh, chromosomes, padding };
        this.updateMembraneTransform(membrane);
        this.animations.push({
            update: () => {
                this.updateMembraneTransform(membrane);
                return true;
            }
        });
        return membrane;
    }

    async anaphaseI(groupA, groupB, separation = 20, duration = 3000) {
        const allChromos = [...groupA, ...groupB];
        const allBalls = allChromos.flatMap(c => c.balls);

        allBalls.forEach(b => b.userData.pinned = true);

        const initials = allChromos.map(c => c.balls.map(b => ({
            x: b.position.x, y: b.position.y, z: b.position.z
        })));

        return new Promise((resolve) => {
            const startTime = Date.now();
            const animate = () => {
                const elapsed = Date.now() - startTime;
                const progress = Math.min(elapsed / duration, 1);
                const eased = this.easeInOutCubic(progress);

                const offset = separation * 0.5 * eased;

                allChromos.forEach((chromo, ci) => {
                    const dir = groupA.includes(chromo) ? 1 : -1;
                    chromo.balls.forEach((ball, bi) => {
                        const init = initials[ci][bi];
                        ball.position.x = init.x + dir * offset;
                        ball.userData.oldX = ball.position.x;
                        ball.userData.oldY = ball.position.y;
                        ball.userData.oldZ = ball.position.z;
                    });
                });

                if (progress < 1) {
                    requestAnimationFrame(animate);
                } else {
                    allBalls.forEach(b => b.userData.pinned = false);
                    resolve();
                }
            };
            animate();
        });
    }

    updateMembraneTransform(membrane) {
        const balls = membrane.chromosomes.flatMap(c => c.balls);
        if (balls.length === 0) return;

        let cx = 0, cy = 0, cz = 0;
        for (const b of balls) {
            cx += b.position.x;
            cy += b.position.y;
            cz += b.position.z;
        }
        cx /= balls.length;
        cy /= balls.length;
        cz /= balls.length;

        let maxDist = 0;
        for (const b of balls) {
            const dx = b.position.x - cx;
            const dy = b.position.y - cy;
            const dz = b.position.z - cz;
            const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
            if (dist > maxDist) maxDist = dist;
        }

        const r = maxDist + membrane.padding;
        const m = membrane.mesh;
        m.position.x += (cx - m.position.x) * 0.1;
        m.position.y += (cy - m.position.y) * 0.1;
        m.position.z += (cz - m.position.z) * 0.1;
        m.scale.x += (r - m.scale.x) * 0.1;
        m.scale.y += (r - m.scale.y) * 0.1;
        m.scale.z += (r - m.scale.z) * 0.1;
    }
}
