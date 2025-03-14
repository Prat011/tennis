import './style.css'
import * as THREE from 'three'

class TennisGame {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private court: THREE.Mesh;
  private ball: THREE.Mesh;
  private paddle1: THREE.Mesh;
  private paddle2: THREE.Mesh;
  
  // Game state
  private ballSpeed = { x: 0, y: 0, z: 0 };
  private paddleSpeed = 0.3;
  private score = { player: 0, ai: 0 };
  private keys: { [key: string]: boolean } = {};
  private scoreElement: HTMLDivElement;
  private ballInPlay: boolean = false;
  private instructionElement: HTMLDivElement;
  private lastAiTarget: number = 0;

  // Audio context and music state
  private audioContext: AudioContext = new AudioContext();
  private isMusicPlaying: boolean = false;
  private currentNoteIndex: number = 0;
  private nextNoteTime: number = 0;
  private musicGain: GainNode = this.audioContext.createGain();

  constructor() {
    // Initialize audio
    this.initializeAudio();

    // Initialize scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87ceeb); // Sky blue background

    // Initialize camera with player perspective
    this.camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    this.camera.position.set(-11, 2, 0); // Position behind player paddle
    this.camera.lookAt(0, 1, 0); // Look at center of court

    // Initialize renderer with shadows
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.body.appendChild(this.renderer.domElement);

    // Create stadium environment
    this.createStadium();

    // Create tennis court with markings
    const courtGeometry = new THREE.PlaneGeometry(20, 10);
    const courtMaterial = new THREE.MeshPhongMaterial({
      color: 0x4CAF50,
      side: THREE.DoubleSide
    });
    this.court = new THREE.Mesh(courtGeometry, courtMaterial);
    this.court.rotation.x = -Math.PI / 2;
    this.court.receiveShadow = true;
    this.scene.add(this.court);

    // Add court lines
    this.addCourtLines();

    // Create ball
    const ballGeometry = new THREE.SphereGeometry(0.2, 32, 32);
    const ballMaterial = new THREE.MeshPhongMaterial({ color: 0xFFFF00 });
    this.ball = new THREE.Mesh(ballGeometry, ballMaterial);
    this.ball.position.y = 1;
    this.ball.castShadow = true;
    this.scene.add(this.ball);

    // Create paddles
    const paddleGeometry = new THREE.BoxGeometry(0.5, 1.5, 0.2);
    const paddleMaterial = new THREE.MeshPhongMaterial({ color: 0x2196F3 });
    
    this.paddle1 = new THREE.Mesh(paddleGeometry, paddleMaterial);
    this.paddle1.position.set(-9, 1, 0);
    this.paddle1.castShadow = true;
    this.scene.add(this.paddle1);

    this.paddle2 = new THREE.Mesh(paddleGeometry, paddleMaterial);
    this.paddle2.position.set(9, 1, 0);
    this.paddle2.castShadow = true;
    this.scene.add(this.paddle2);

    // Add lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
    this.scene.add(ambientLight);

    // Enhanced player spotlights
    const createPlayerSpotlight = (x: number, isPlayer: boolean) => {
      const group = new THREE.Group();

      // Main spotlight from above
      const topLight = new THREE.SpotLight(0xffffff, 2);
      topLight.position.set(x, 12, 0);
      topLight.target.position.set(x, 0, 0);
      topLight.angle = Math.PI / 8;
      topLight.penumbra = 0.2;
      topLight.decay = 1;
      topLight.distance = 20;
      topLight.castShadow = true;
      topLight.shadow.mapSize.width = 1024;
      topLight.shadow.mapSize.height = 1024;
      
      // Secondary spotlight for dramatic effect
      const backLight = new THREE.SpotLight(0xffffff, 1);
      backLight.position.set(x + (isPlayer ? 2 : -2), 8, 0);
      backLight.target.position.set(x, 1, 0);
      backLight.angle = Math.PI / 12;
      backLight.penumbra = 0.3;
      backLight.decay = 1.5;
      backLight.distance = 15;
      
      group.add(topLight);
      group.add(topLight.target);
      group.add(backLight);
      group.add(backLight.target);
      
      return group;
    };

    // Add enhanced spotlights for both players
    const player1Lights = createPlayerSpotlight(-9, true);
    const player2Lights = createPlayerSpotlight(9, false);
    this.scene.add(player1Lights);
    this.scene.add(player2Lights);

    // Main stadium lights
    const createStadiumLight = (x: number, z: number) => {
      const light = new THREE.SpotLight(0xffffff, 1.5); // Increased intensity
      light.position.set(x, 25, z);
      light.angle = Math.PI / 5; // Wider angle
      light.penumbra = 0.3;
      light.decay = 1;
      light.distance = 50;
      light.castShadow = true;
      light.shadow.mapSize.width = 1024;
      light.shadow.mapSize.height = 1024;
      light.shadow.camera.near = 10;
      light.shadow.camera.far = 50;
      light.shadow.bias = -0.001;
      return light;
    };

    // Four stadium lights at corners
    const light1 = createStadiumLight(-15, -15);
    const light2 = createStadiumLight(15, -15);
    const light3 = createStadiumLight(-15, 15);
    const light4 = createStadiumLight(15, 15);

    this.scene.add(light1);
    this.scene.add(light2);
    this.scene.add(light3);
    this.scene.add(light4);

    // Add court-specific lighting
    const createCourtLight = (x: number) => {
      const light = new THREE.DirectionalLight(0xffffff, 0.4);
      light.position.set(x, 15, 0);
      light.target.position.set(x, 0, 0);
      light.castShadow = true;
      light.shadow.camera.left = -7;
      light.shadow.camera.right = 7;
      light.shadow.camera.top = 7;
      light.shadow.camera.bottom = -7;
      light.shadow.mapSize.width = 1024;
      light.shadow.mapSize.height = 1024;
      this.scene.add(light.target);
      return light;
    };

    // Add court lights
    const courtLight1 = createCourtLight(-5);
    const courtLight2 = createCourtLight(5);
    this.scene.add(courtLight1);
    this.scene.add(courtLight2);

    // Add light fixtures (visual representation of lights)
    const createLightFixture = (x: number, z: number) => {
      const fixture = new THREE.Group();
      
      // Light housing
      const housing = new THREE.Mesh(
        new THREE.CylinderGeometry(1, 1.5, 2, 8),
        new THREE.MeshPhongMaterial({ color: 0x333333 })
      );
      
      // Support pole
      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.3, 0.3, 10, 8),
        new THREE.MeshPhongMaterial({ color: 0x666666 })
      );
      pole.position.y = -6;
      
      fixture.add(housing);
      fixture.add(pole);
      fixture.position.set(x, 25, z);
      fixture.rotation.x = x > 0 ? Math.PI / 6 : -Math.PI / 6;
      fixture.rotation.z = z > 0 ? -Math.PI / 6 : Math.PI / 6;
      
      return fixture;
    };

    // Add visual light fixtures at each corner
    this.scene.add(createLightFixture(-15, -15));
    this.scene.add(createLightFixture(15, -15));
    this.scene.add(createLightFixture(-15, 15));
    this.scene.add(createLightFixture(15, 15));

    // Create score display
    this.scoreElement = document.createElement('div');
    this.scoreElement.style.position = 'absolute';
    this.scoreElement.style.top = '20px';
    this.scoreElement.style.left = '50%';
    this.scoreElement.style.transform = 'translateX(-50%)';
    this.scoreElement.style.color = 'white';
    this.scoreElement.style.fontSize = '24px';
    this.scoreElement.style.fontFamily = 'Arial, sans-serif';
    document.body.appendChild(this.scoreElement);

    // Create instruction display
    this.instructionElement = document.createElement('div');
    this.instructionElement.style.position = 'absolute';
    this.instructionElement.style.bottom = '20px';
    this.instructionElement.style.left = '50%';
    this.instructionElement.style.transform = 'translateX(-50%)';
    this.instructionElement.style.color = 'white';
    this.instructionElement.style.fontSize = '20px';
    this.instructionElement.style.fontFamily = 'Arial, sans-serif';
    document.body.appendChild(this.instructionElement);

    // Setup event listeners
    window.addEventListener('resize', this.onWindowResize.bind(this));
    window.addEventListener('keydown', (e) => this.keys[e.key.toLowerCase()] = true);
    window.addEventListener('keyup', (e) => this.keys[e.key.toLowerCase()] = false);

    // Start game
    this.resetBall();
    this.animate();
  }

  private initializeAudio(): void {
    // Initialize music gain node
    this.musicGain.gain.value = 0.2; // Set music volume
    this.musicGain.connect(this.audioContext.destination);
    
    // Start music by default
    this.isMusicPlaying = true;
    this.currentNoteIndex = 0;
    this.nextNoteTime = this.audioContext.currentTime;

    // Add instructions about music toggle
    const musicInstructions = document.createElement('div');
    musicInstructions.style.position = 'absolute';
    musicInstructions.style.top = '50px';
    musicInstructions.style.left = '50%';
    musicInstructions.style.transform = 'translateX(-50%)';
    musicInstructions.style.color = 'white';
    musicInstructions.style.fontSize = '16px';
    musicInstructions.style.fontFamily = 'Arial, sans-serif';
    musicInstructions.textContent = 'Press M to toggle music';
    document.body.appendChild(musicInstructions);
  }

  private playHitSound(): void {
    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();
    
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(220, this.audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.1);
    
    gainNode.gain.setValueAtTime(0.3, this.audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.1);
    
    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);
    
    oscillator.start();
    oscillator.stop(this.audioContext.currentTime + 0.1);
  }

  private playScoreSound(): void {
    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();
    
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(440, this.audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(880, this.audioContext.currentTime + 0.2);
    
    gainNode.gain.setValueAtTime(0.4, this.audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.2);
    
    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);
    
    oscillator.start();
    oscillator.stop(this.audioContext.currentTime + 0.2);
  }

  private playWallHitSound(): void {
    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();
    
    oscillator.type = 'square';
    oscillator.frequency.setValueAtTime(110, this.audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(55, this.audioContext.currentTime + 0.1);
    
    gainNode.gain.setValueAtTime(0.2, this.audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.1);
    
    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);
    
    oscillator.start();
    oscillator.stop(this.audioContext.currentTime + 0.1);
  }

  private createStadium(): void {
    // Create stadium floor
    const floorGeometry = new THREE.PlaneGeometry(60, 40);
    const floorMaterial = new THREE.MeshPhongMaterial({
      color: 0x808080,
      side: THREE.DoubleSide
    });
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.1;
    floor.receiveShadow = true;
    this.scene.add(floor);

    // Create stadium walls
    const wallMaterial = new THREE.MeshPhongMaterial({
      color: 0xcccccc,
      side: THREE.DoubleSide
    });

    // Back wall
    const backWallGeometry = new THREE.PlaneGeometry(60, 20);
    const backWall = new THREE.Mesh(backWallGeometry, wallMaterial);
    backWall.position.set(0, 10, -20);
    backWall.receiveShadow = true;
    this.scene.add(backWall);

    // Front wall
    const frontWall = new THREE.Mesh(backWallGeometry, wallMaterial);
    frontWall.position.set(0, 10, 20);
    frontWall.receiveShadow = true;
    this.scene.add(frontWall);

    // Add backdrop behind AI player
    const createBackdrop = () => {
      const group = new THREE.Group();

      // Main backdrop wall (closer to the court)
      const backdropWallMaterial = new THREE.MeshPhongMaterial({
        color: 0x2c3e50,
        side: THREE.DoubleSide
      });
      const backdropWall = new THREE.Mesh(
        new THREE.PlaneGeometry(15, 8),
        backdropWallMaterial
      );
      backdropWall.position.set(11, 4, 0);
      backdropWall.rotation.y = Math.PI / 2;
      backdropWall.receiveShadow = true;
      group.add(backdropWall);

      // Add decorative panels
      const panelMaterial = new THREE.MeshPhongMaterial({
        color: 0x34495e,
        side: THREE.DoubleSide
      });

      // Create a row of panels
      for (let z = -6; z <= 6; z += 2) {
        const panel = new THREE.Mesh(
          new THREE.PlaneGeometry(1.8, 3),
          panelMaterial
        );
        panel.position.set(11.1, 4, z);
        panel.rotation.y = Math.PI / 2;
        panel.receiveShadow = true;
        group.add(panel);
      }

      // Add sponsor board
      const sponsorGeometry = new THREE.PlaneGeometry(8, 2);
      const sponsorMaterial = new THREE.MeshPhongMaterial({
        color: 0x3498db,
        side: THREE.DoubleSide
      });
      const sponsorBoard = new THREE.Mesh(sponsorGeometry, sponsorMaterial);
      sponsorBoard.position.set(11.2, 6, 0);
      sponsorBoard.rotation.y = Math.PI / 2;
      group.add(sponsorBoard);

      // Add bottom barrier
      const barrierGeometry = new THREE.BoxGeometry(0.3, 1, 12);
      const barrierMaterial = new THREE.MeshPhongMaterial({ color: 0x95a5a6 });
      const barrier = new THREE.Mesh(barrierGeometry, barrierMaterial);
      barrier.position.set(10.5, 0.5, 0);
      barrier.castShadow = true;
      barrier.receiveShadow = true;
      group.add(barrier);

      return group;
    };

    // Add the backdrop
    this.scene.add(createBackdrop());

    // Create stands (bleachers)
    this.createStands();
  }

  private createStands(): void {
    const rowCount = 10;
    const seatColor = new THREE.Color(0x333333);
    const seatMaterial = new THREE.MeshPhongMaterial({ color: seatColor });

    // Create stands on both sides
    for (let side = -1; side <= 1; side += 2) {
      for (let row = 0; row < rowCount; row++) {
        const rowGeometry = new THREE.BoxGeometry(30, 0.5, 1);
        const rowMesh = new THREE.Mesh(rowGeometry, seatMaterial);
        
        // Position each row higher and further back
        rowMesh.position.set(0, 1 + row * 0.8, side * (7 + row * 0.8));
        rowMesh.rotation.x = side * 0.2; // Tilt the stands slightly
        rowMesh.receiveShadow = true;
        rowMesh.castShadow = true;
        this.scene.add(rowMesh);

        // Add vertical supports every few units
        for (let x = -14; x <= 14; x += 7) {
          const supportGeometry = new THREE.BoxGeometry(0.3, row * 0.8, 0.3);
          const support = new THREE.Mesh(supportGeometry, seatMaterial);
          support.position.set(x, 0.5 + (row * 0.8) / 2, side * (7 + row * 0.8));
          support.castShadow = true;
          this.scene.add(support);
        }
      }
    }

    // Add crowd (simplified as boxes with random heights)
    const crowdColors = [0x2196F3, 0xF44336, 0x4CAF50, 0xFFC107, 0x9C27B0];
    
    for (let side = -1; side <= 1; side += 2) {
      for (let row = 0; row < rowCount - 2; row++) {
        for (let x = -13; x <= 13; x += 1.5) {
          if (Math.random() > 0.3) { // 70% chance of a spectator
            const height = 0.5 + Math.random() * 0.3;
            const spectatorGeometry = new THREE.BoxGeometry(0.7, height, 0.3);
            const spectatorMaterial = new THREE.MeshPhongMaterial({
              color: crowdColors[Math.floor(Math.random() * crowdColors.length)]
            });
            const spectator = new THREE.Mesh(spectatorGeometry, spectatorMaterial);
            
            spectator.position.set(
              x,
              1.5 + row * 0.8,
              side * (7 + row * 0.8)
            );
            spectator.castShadow = true;
            this.scene.add(spectator);
          }
        }
      }
    }
  }

  private addCourtLines(): void {
    const lineMaterial = new THREE.LineBasicMaterial({ color: 0xffffff });
    
    // Center line
    const centerGeometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0.01, -5),
      new THREE.Vector3(0, 0.01, 5)
    ]);
    const centerLine = new THREE.Line(centerGeometry, lineMaterial);
    this.scene.add(centerLine);

    // Service lines
    const serviceLineGeometry1 = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-5, 0.01, -5),
      new THREE.Vector3(-5, 0.01, 5)
    ]);
    const serviceLine1 = new THREE.Line(serviceLineGeometry1, lineMaterial);
    this.scene.add(serviceLine1);

    const serviceLineGeometry2 = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(5, 0.01, -5),
      new THREE.Vector3(5, 0.01, 5)
    ]);
    const serviceLine2 = new THREE.Line(serviceLineGeometry2, lineMaterial);
    this.scene.add(serviceLine2);
  }

  private resetBall(): void {
    // Position ball slightly in front of player's paddle
    this.ball.position.set(-8, 1, this.paddle1.position.z);
    this.ballSpeed.x = 0;
    this.ballSpeed.z = 0;
    this.ballInPlay = false;
    this.showInstructions("Press SPACE to serve");
  }

  private showInstructions(text: string): void {
    this.instructionElement.textContent = text;
  }

  private hideInstructions(): void {
    this.instructionElement.textContent = '';
  }

  private launchBall(): void {
    if (!this.ballInPlay) {
      this.ballInPlay = true;
      this.ballSpeed.x = 0.2; // Reduced from 0.3
      this.ballSpeed.z = (Math.random() - 0.5) * 0.15; // Reduced random vertical variation
      this.hideInstructions();
    }
  }

  private updateScore(): void {
    this.scoreElement.textContent = `Player: ${this.score.player} | AI: ${this.score.ai}`;
  }

  private updatePaddles(): void {
    // Player 1 controls (A/D or Left/Right arrow keys)
    const moveLeft = this.keys['a'] || this.keys['arrowleft'];
    const moveRight = this.keys['d'] || this.keys['arrowright'];

    if (moveLeft && this.paddle1.position.z > -4) {
      this.paddle1.position.z -= this.paddleSpeed;
    }
    if (moveRight && this.paddle1.position.z < 4) {
      this.paddle1.position.z += this.paddleSpeed;
    }

    // If ball is not in play, make it follow the paddle
    if (!this.ballInPlay) {
      this.ball.position.z = this.paddle1.position.z;
    }

    // Update camera to follow player paddle
    this.camera.position.z = this.paddle1.position.z;

    // Improved AI movement
    const aiSpeed = 0.15;
    
    // Calculate target position with improved prediction
    let aiTarget = this.ball.position.z;
    
    // Adjust prediction based on ball direction and position
    if (this.ballSpeed.x > 0) {
      // Ball moving towards AI
      const distanceToAI = Math.abs(this.paddle2.position.x - this.ball.position.x);
      const timeToReach = distanceToAI / this.ballSpeed.x;
      aiTarget = this.ball.position.z + (this.ballSpeed.z * timeToReach);
      
      // Clamp predicted position to court boundaries
      aiTarget = Math.max(-4, Math.min(4, aiTarget));
    } else {
      // Ball moving away from AI, return to center with slight bias towards ball
      aiTarget = this.ball.position.z * 0.3;
    }
    
    // Smooth out AI movement using interpolation
    this.lastAiTarget = this.lastAiTarget * 0.8 + aiTarget * 0.2;
    
    // Move AI paddle towards target
    const targetDiff = this.lastAiTarget - this.paddle2.position.z;
    const moveDirection = Math.sign(targetDiff);
    const moveAmount = Math.min(Math.abs(targetDiff), aiSpeed);
    
    // Only move if the difference is significant enough
    if (Math.abs(targetDiff) > 0.1) {
      this.paddle2.position.z += moveDirection * moveAmount;
    }
    
    // Ensure paddle stays within bounds
    this.paddle2.position.z = Math.max(-4, Math.min(4, this.paddle2.position.z));

    // Check for spacebar press to launch ball
    if (this.keys[' '] && !this.ballInPlay) {
      this.launchBall();
    }

    // Add music toggle with 'M' key
    if (this.keys['m'] && !this.keys['m_last']) {
      this.toggleMusic();
    }
    this.keys['m_last'] = this.keys['m'];
  }

  private updateBall(): void {
    if (!this.ballInPlay) return;

    // Update ball position
    this.ball.position.x += this.ballSpeed.x;
    this.ball.position.z += this.ballSpeed.z;

    // Ball and paddle collision
    const paddleHitbox = 0.8;
    
    // Player paddle collision
    if (this.ball.position.x <= -8.8 && this.ball.position.x >= -9.2) {
      if (Math.abs(this.ball.position.z - this.paddle1.position.z) < paddleHitbox) {
        this.playHitSound();
        const hitPosition = (this.ball.position.z - this.paddle1.position.z) / paddleHitbox;
        this.ballSpeed.x = Math.abs(this.ballSpeed.x) * 1.03;
        this.ballSpeed.z = hitPosition * 0.3;
      }
    }

    // AI paddle collision
    if (this.ball.position.x >= 8.8 && this.ball.position.x <= 9.2) {
      if (Math.abs(this.ball.position.z - this.paddle2.position.z) < paddleHitbox) {
        this.playHitSound();
        const hitPosition = (this.ball.position.z - this.paddle2.position.z) / paddleHitbox;
        this.ballSpeed.x = -Math.abs(this.ballSpeed.x) * 1.03;
        this.ballSpeed.z = hitPosition * 0.3;
      }
    }

    // Court boundaries with sound
    if (this.ball.position.z > 5 || this.ball.position.z < -5) {
      this.playWallHitSound();
      this.ballSpeed.z = -this.ballSpeed.z * 0.9;
      this.ballSpeed.z += (Math.random() - 0.5) * 0.05;
    }

    // Add speed cap to prevent ball from getting too fast
    const maxSpeed = 0.35; // Slightly lower max speed
    const minSpeed = 0.15; // Minimum speed to keep the game moving

    // Normalize horizontal speed
    if (Math.abs(this.ballSpeed.x) > maxSpeed) {
      this.ballSpeed.x = Math.sign(this.ballSpeed.x) * maxSpeed;
    } else if (Math.abs(this.ballSpeed.x) < minSpeed) {
      this.ballSpeed.x = Math.sign(this.ballSpeed.x) * minSpeed;
    }

    // Normalize vertical speed
    const maxVerticalSpeed = maxSpeed * 0.6;
    if (Math.abs(this.ballSpeed.z) > maxVerticalSpeed) {
      this.ballSpeed.z = Math.sign(this.ballSpeed.z) * maxVerticalSpeed;
    }

    // Add slight drag to vertical movement for more controlled volleys
    this.ballSpeed.z *= 0.98;

    // Scoring with sound
    if (this.ball.position.x > 10) {
      this.playScoreSound();
      this.score.player++;
      this.updateScore();
      this.resetBall();
    } else if (this.ball.position.x < -10) {
      this.playScoreSound();
      this.score.ai++;
      this.updateScore();
      this.resetBall();
    }
  }

  private onWindowResize(): void {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  private animate(): void {
    requestAnimationFrame(this.animate.bind(this));
    
    this.updatePaddles();
    this.updateBall();
    this.scheduleNote(); // Add this line to handle music playback
    
    this.renderer.render(this.scene, this.camera);
  }

  // Add these new methods for music playback
  private playNote(frequency: number, duration: number, time: number): void {
    const oscillator = this.audioContext.createOscillator();
    const noteGain = this.audioContext.createGain();
    
    oscillator.type = 'square';
    oscillator.frequency.setValueAtTime(frequency, time);
    
    noteGain.gain.setValueAtTime(1, time);
    noteGain.gain.exponentialRampToValueAtTime(0.01, time + duration - 0.05);
    
    oscillator.connect(noteGain);
    noteGain.connect(this.musicGain);
    
    oscillator.start(time);
    oscillator.stop(time + duration);
  }

  private scheduleNote(): void {
    const tetrisTheme = [
      { note: 'E5', duration: 0.4 }, { note: 'B4', duration: 0.2 }, { note: 'C5', duration: 0.2 },
      { note: 'D5', duration: 0.4 }, { note: 'C5', duration: 0.2 }, { note: 'B4', duration: 0.2 },
      { note: 'A4', duration: 0.4 }, { note: 'A4', duration: 0.2 }, { note: 'C5', duration: 0.2 },
      { note: 'E5', duration: 0.4 }, { note: 'D5', duration: 0.2 }, { note: 'C5', duration: 0.2 },
      { note: 'B4', duration: 0.6 }, { note: 'C5', duration: 0.2 },
      { note: 'D5', duration: 0.4 }, { note: 'E5', duration: 0.4 },
      { note: 'C5', duration: 0.4 }, { note: 'A4', duration: 0.4 },
      { note: 'A4', duration: 0.8 }
    ];

    const noteFrequencies: { [key: string]: number } = {
      'A4': 440.0, 'B4': 493.88, 'C5': 523.25,
      'D5': 587.33, 'E5': 659.25
    };

    if (this.isMusicPlaying && this.audioContext.currentTime >= this.nextNoteTime) {
      const note = tetrisTheme[this.currentNoteIndex];
      this.playNote(noteFrequencies[note.note], note.duration, this.nextNoteTime);
      
      this.nextNoteTime += note.duration;
      this.currentNoteIndex = (this.currentNoteIndex + 1) % tetrisTheme.length;
    }
  }

  private toggleMusic(): void {
    if (this.isMusicPlaying) {
      this.isMusicPlaying = false;
      this.musicGain.gain.setValueAtTime(0, this.audioContext.currentTime);
    } else {
      this.isMusicPlaying = true;
      this.musicGain.gain.setValueAtTime(0.2, this.audioContext.currentTime);
      this.currentNoteIndex = 0;
      this.nextNoteTime = this.audioContext.currentTime;
    }
  }
}

// Start the game
new TennisGame();
