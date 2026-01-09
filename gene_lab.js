import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { DragControls } from 'three/addons/controls/DragControls.js';

export class GeneLab {
    constructor(container) {
        this.container = container || document.body;
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.renderer = new THREE.WebGLRenderer({ antialias: true });

        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.container.appendChild(this.renderer.domElement);

        this.camera.position.z = 25;

        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
        this.scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
        directionalLight.position.set(5, 5, 5);
        this.scene.add(directionalLight);

        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;

        this.draggableObjects = [];
        this.dragControls = new DragControls(this.draggableObjects, this.camera, this.renderer.domElement);

        this.dragControls.addEventListener('dragstart', () => {
            this.controls.enabled = false;
        });

        this.dragControls.addEventListener('dragend', () => {
            this.controls.enabled = true;
        });

        this.animate();

        window.addEventListener('resize', () => this.onWindowResize());
    }

    addBall(x = 0, y = 0, z = 0, color) {
        const geometry = new THREE.SphereGeometry(1, 32, 32);
        const material = new THREE.MeshStandardMaterial({ color: color });
        const sphere = new THREE.Mesh(geometry, material);
        sphere.position.set(x, y, z);
        this.scene.add(sphere);
        this.draggableObjects.push(sphere);
        return sphere;
    }

    addConnectedBall(parent) {
        const child = this.addBall(parent.position.x, parent.position.y-3, parent.position.z, parent.material.color);

        //parent.add(child);

        //this.scene.add(child);

        return child;

    }

    addStickBall(parent) {
        const child = this.addBall(parent.position.x, parent.position.y-5, parent.position.z, parent.material.color);
        //this.scene.add(child);

        const material = new THREE.LineBasicMaterial({ color: 0xffffff });
        const points = [];
        points.push(parent.position);
        points.push(child.position);
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const line = new THREE.Line(geometry, material);
        this.scene.add(line);
        return child;
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        this.controls.update();
        this.renderer.render(this.scene, this.camera);
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }
}
