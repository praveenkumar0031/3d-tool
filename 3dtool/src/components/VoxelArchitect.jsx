import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

const VoxelArchitect = () => {
  // --- React State for HUD UI ---
  const [sysMode, setSysMode] = useState('INITIALIZING');
  const [voxelCount, setVoxelCount] = useState(0);

  // --- DOM Refs ---
  const videoRef = useRef(null);
  const bioCanvasRef = useRef(null);
  const threeCanvasRef = useRef(null);

  // --- Core Configuration Variables ---
  const gridSize = 1.2;
  const colorPalette = [
    0x00f0ff, 0xff0000, 0x0000ff, 0x00ff00, 0xffff00, 0xff00ff, 
    0xffa500, 0x800080, 0x00ff7f, 0xff1493, 0x7fff00, 0x40e0d0, 
    0xffd700, 0xff4500, 0x9370db, 0x00ced1, 0xf08080, 0xadff2f, 
    0xff6347, 0x00bfff, 0xda70d6
  ];

  useEffect(() => {
    // 1. Guard against unmounted DOM nodes
    if (!videoRef.current || !bioCanvasRef.current || !threeCanvasRef.current) return;

    // 2. Guard against missing CDN dependencies
    if (!window.Hands || !window.Camera) {
      setSysMode('ERROR: MEDIAPIPE CDN NOT LOADED IN INDEX.HTML');
      return;
    }

    // --- A. INITIALIZE THREE.JS SCENE ---
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ 
      canvas: threeCanvasRef.current, 
      antialias: true, 
      alpha: true 
    });
    renderer.setSize(window.innerWidth, window.innerHeight);

    const voxelGroup = new THREE.Group();
    scene.add(voxelGroup);
    const currentSketch = new THREE.Group();
    voxelGroup.add(currentSketch);

    const placedVoxels = new Map();

    const crosshair = new THREE.Mesh(
      new THREE.BoxGeometry(gridSize, gridSize, gridSize),
      new THREE.MeshBasicMaterial({ color: 0x00f0ff, wireframe: true, transparent: true, opacity: 0.5 })
    );
    scene.add(crosshair);

    scene.add(new THREE.AmbientLight(0xffffff, 0.5));
    const sun = new THREE.DirectionalLight(0xffffff, 1.0);
    sun.position.set(5, 5, 5);
    scene.add(sun);
    camera.position.z = 20;

    // --- B. TRACKING STATE PARAMETERS ---
    let smoothedLandmarks = { Left: [], Right: [] };
    let gravityEnabled = false;
    let rainbowActive = false;
    let gravityTimer = 0;
    let restoreTimer = 0;
    const GRAVITY_HOLD = 800;

    let globalColorIndex = 0;
    let leftPeaceWasActive = false;

    let isGrabbing = false, grabTimer = 0;
    let grabOffset = new THREE.Vector3();
    let isBuilding = false, buildTimer = 0;
    let isErasing = false, eraseTimer = 0;
    let resetTimer = 0, rotateTimer = 0;
    let startPinchPos = null, activeAxis = null;
    let sketchKeys = new Set();

    const GRAB_HOLD = 500;
    const INTENT_HOLD = 500;
    const RESET_HOLD = 1000;
    const ROTATE_HOLD = 1000;
    const pinchThreshold = 0.05;

    // --- C. UTILITY MATHEMATICS & RENDERING FUNCTIONS ---
    const getFloorY = () => {
      const vFOV = THREE.MathUtils.degToRad(camera.fov);
      const height = 2 * Math.tan(vFOV / 2) * camera.position.z;
      return -(height / 2) + (gridSize / 2);
    };

    const getDist = (p1, p2) => {
      return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2) + (p1.z && p2.z ? Math.pow(p1.z - p2.z, 2) : 0));
    };

    const drawHUDCircle = (ctx, x, y, progress, color) => {
      ctx.beginPath();
      ctx.arc(x, y, 35, -Math.PI / 2, (-Math.PI / 2) + (Math.PI * 2 * progress));
      ctx.lineWidth = 5; ctx.strokeStyle = color; ctx.stroke();
      ctx.setLineDash([3, 5]);
      ctx.beginPath(); ctx.arc(x, y, 30, 0, Math.PI * 2); ctx.lineWidth = 1; ctx.stroke();
      ctx.setLineDash([]);
    };

    const drawCyberHand = (ctx, landmarks, label) => {
      if (!smoothedLandmarks[label] || smoothedLandmarks[label].length === 0) {
        smoothedLandmarks[label] = landmarks.map(p => ({ ...p }));
      } else {
        landmarks.forEach((p, i) => {
          smoothedLandmarks[label][i].x += (p.x - smoothedLandmarks[label][i].x) * 0.45;
          smoothedLandmarks[label][i].y += (p.y - smoothedLandmarks[label][i].y) * 0.45;
          smoothedLandmarks[label][i].z += (p.z - smoothedLandmarks[label][i].z) * 0.1;
        });
      }
      const pts = smoothedLandmarks[label];
      ctx.shadowBlur = 10; ctx.shadowColor = "#00f0ff";
      ctx.beginPath(); ctx.strokeStyle = "rgba(0, 240, 255, 0.6)"; ctx.lineWidth = 2;
      const CONNECTIONS = [[0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8], [9, 10], [10, 11], [11, 12], [13, 14], [14, 15], [15, 16], [0, 17], [17, 18], [18, 19], [19, 20], [5, 9], [9, 13], [13, 17], [0, 5]];
      CONNECTIONS.forEach(([a, b]) => {
        ctx.moveTo(pts[a].x * bioCanvasRef.current.width, pts[a].y * bioCanvasRef.current.height);
        ctx.lineTo(pts[b].x * bioCanvasRef.current.width, pts[b].y * bioCanvasRef.current.height);
      });
      ctx.stroke();
      pts.forEach((pt, i) => {
        const x = pt.x * bioCanvasRef.current.width, y = pt.y * bioCanvasRef.current.height;
        if ([4, 8, 12, 16, 20].includes(i)) {
          ctx.strokeStyle = "#00f0ff"; ctx.strokeRect(x - 6, y - 6, 12, 12);
        } else { ctx.fillStyle = "#fff"; ctx.fillRect(x - 2, y - 2, 4, 4); }
      });
    };

    const addSketchVoxel = (x, y, z) => {
      const key = `${x.toFixed(1)},${y.toFixed(1)},${z.toFixed(1)}`;
      if (sketchKeys.has(key) || placedVoxels.has(key)) return;
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(gridSize * 0.98, gridSize * 0.98, gridSize * 0.98), new THREE.MeshBasicMaterial({ color: colorPalette[globalColorIndex], wireframe: true }));
      mesh.position.set(x, y, z);
      currentSketch.add(mesh);
      sketchKeys.add(key);
    };

    const createFinalCube = (x, y, z) => {
      const g = new THREE.BoxGeometry(gridSize * 0.95, gridSize * 0.95, gridSize * 0.95);
      const m = new THREE.MeshPhongMaterial({ color: 0x001122, emissive: colorPalette[globalColorIndex], emissiveIntensity: 0.4, transparent: true, opacity: 0.8 });
      const mesh = new THREE.Mesh(g, m);
      mesh.position.set(x, y, z);
      mesh.origin = new THREE.Vector3(x, y, z);
      mesh.velocity = new THREE.Vector3(0, 0, 0);
      mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(g), new THREE.LineBasicMaterial({ color: colorPalette[globalColorIndex] })));
      return mesh;
    };

    const commitVoxels = () => {
      while (currentSketch.children.length > 0) {
        const f = currentSketch.children[0];
        const key = `${f.position.x.toFixed(1)},${f.position.y.toFixed(1)},${f.position.z.toFixed(1)}`;
        const cube = createFinalCube(f.position.x, f.position.y, f.position.z);
        voxelGroup.add(cube);
        placedVoxels.set(key, cube);
        currentSketch.remove(f);
      }
      setVoxelCount(placedVoxels.size);
    };

    const initiateGravityFall = () => {
      placedVoxels.forEach((v) => {
        v.velocity.set((Math.random() - 0.5) * 0.8, 0.4 + Math.random() * 0.5, (Math.random() - 0.5) * 0.8);
        v.isBouncing = false;
      });
    };

    // --- D. GESTURE INTELLIGENCE PIPELINE ---
    const onResults = (results) => {
      if (!bioCanvasRef.current) return;
      const bioCtx = bioCanvasRef.current.getContext('2d');
      bioCtx.clearRect(0, 0, bioCanvasRef.current.width, bioCanvasRef.current.height);
      crosshair.visible = false;

      if (!results.multiHandLandmarks) {
        grabTimer = 0; buildTimer = 0; eraseTimer = 0;
        resetTimer = 0; rotateTimer = 0; gravityTimer = 0; restoreTimer = 0;
        return;
      }

      let lHand = null, rHand = null;
      results.multiHandedness.forEach((hand, idx) => {
        const landmarks = results.multiHandLandmarks[idx];
        drawCyberHand(bioCtx, landmarks, hand.label);
        if (hand.label === 'Left') lHand = smoothedLandmarks['Left'];
        if (hand.label === 'Right') rHand = smoothedLandmarks['Right'];
      });

      // Synchronized Two-Hand States
      if (lHand && rHand) {
        const lFist = lHand[8].y > lHand[6].y && lHand[12].y > lHand[10].y && lHand[16].y > lHand[14].y;
        const rFist = rHand[8].y > rHand[6].y && rHand[12].y > rHand[10].y && rHand[16].y > rHand[14].y;
        const lPalm = lHand[8].y < lHand[6].y && lHand[12].y < lHand[10].y && lHand[20].y < lHand[18].y;
        const rPalm = rHand[8].y < rHand[6].y && rHand[12].y < rHand[10].y && rHand[20].y < rHand[18].y;

        if (lFist && rFist) {
          if (resetTimer < RESET_HOLD) {
            resetTimer += 16;
            drawHUDCircle(bioCtx, bioCanvasRef.current.width / 2, bioCanvasRef.current.height / 2, resetTimer / RESET_HOLD, "#ff0055");
            setSysMode("SYSTEM: HOLD TO RESET...");
          } else if (resetTimer >= RESET_HOLD && resetTimer < 2000) {
            voxelGroup.position.set(0, 0, 0);
            voxelGroup.rotation.set(0, 0, 0);
            setSysMode("SYSTEM: HARD_RESET COMPLETE");
            resetTimer = 2000;
          }
          return;
        } else { resetTimer = 0; }

        if (lPalm && rPalm) {
          if (rotateTimer < ROTATE_HOLD) {
            rotateTimer += 16;
            drawHUDCircle(bioCtx, bioCanvasRef.current.width / 2, bioCanvasRef.current.height / 2, rotateTimer / ROTATE_HOLD, "#00f0ff");
            setSysMode("SYSTEM: HOLD TO ENABLE ROTATION...");
          } else {
            setSysMode("SYSTEM: GLOBAL_ROTATE ACTIVE");
            voxelGroup.rotation.y += (rHand[9].x - lHand[9].x - 0.5) * 0.05;
            voxelGroup.rotation.x += (rHand[9].y - lHand[9].y) * 0.05;
          }
          return;
        } else { rotateTimer = 0; }
      }

      // Left Hand Commands
      if (lHand) {
        const fingersCurled = lHand[8].y > lHand[6].y && lHand[12].y > lHand[10].y && lHand[16].y > lHand[14].y && lHand[20].y > lHand[18].y;
        const isFist = fingersCurled && getDist(lHand[4], lHand[12]) < 0.1;
        const isPalm = lHand[8].y < lHand[6].y && lHand[12].y < lHand[10].y && lHand[20].y < lHand[18].y;
        const isThumbDown = lHand[4].y > lHand[3].y && lHand[4].y > lHand[17].y && fingersCurled;
        const isThumbUp = lHand[4].y < lHand[3].y && lHand[4].y < lHand[5].y && fingersCurled;

        const isLeftPeace = lHand[8].y < lHand[6].y && lHand[12].y < lHand[10].y && lHand[16].y > lHand[14].y && lHand[20].y > lHand[18].y;
        if (isLeftPeace && !leftPeaceWasActive) {
          globalColorIndex = (globalColorIndex + 1) % colorPalette.length;
          leftPeaceWasActive = true;
        } else if (!isLeftPeace) {
          leftPeaceWasActive = false;
        }

        if (isPalm) {
          isGrabbing = false;
          grabTimer = 0;
          setSysMode("BIO_LINK: SCANNING");
        }

        if (isThumbDown && !isFist) {
          restoreTimer = 0;
          if (!gravityEnabled) {
            if (gravityTimer < GRAVITY_HOLD) {
              gravityTimer += 16;
              drawHUDCircle(bioCtx, lHand[4].x * bioCanvasRef.current.width, lHand[4].y * bioCanvasRef.current.height, gravityTimer / GRAVITY_HOLD, "#ff00ff");
              setSysMode("BIO_LINK: INITIATING BURST...");
            } else {
              gravityEnabled = true;
              initiateGravityFall();
              setSysMode("BIO_LINK: GRAVITY_ACTIVE");
              gravityTimer = 0;
            }
          }
        } else if (isThumbUp && !isFist) {
          gravityTimer = 0;
          if (gravityEnabled) {
            if (restoreTimer < GRAVITY_HOLD) {
              restoreTimer += 16;
              drawHUDCircle(bioCtx, lHand[4].x * bioCanvasRef.current.width, lHand[4].y * bioCanvasRef.current.height, restoreTimer / GRAVITY_HOLD, "#00ff88");
              setSysMode("BIO_LINK: RESTORING COORDS...");
            } else {
              gravityEnabled = false;
              setSysMode("BIO_LINK: STRUCTURE_RESTORED");
              restoreTimer = 0;
            }
          }
        } else {
          gravityTimer = 0; restoreTimer = 0;
        }

        if (isFist && !isThumbDown && !isThumbUp) {
          if (grabTimer < GRAB_HOLD) {
            grabTimer += 16;
            drawHUDCircle(bioCtx, lHand[0].x * bioCanvasRef.current.width, lHand[0].y * bioCanvasRef.current.height, grabTimer / GRAB_HOLD, "#ffbb00");
          } else {
            const handWorldPos = new THREE.Vector3((0.5 - lHand[9].x) * 25, (0.5 - lHand[9].y) * 18, 0);
            if (!isGrabbing) { grabOffset.copy(voxelGroup.position).sub(handWorldPos); isGrabbing = true; }
            voxelGroup.position.copy(handWorldPos).add(grabOffset);
            setSysMode("BIO_LINK: GRABBED");
          }
        } else if (isGrabbing) {
          const handWorldPos = new THREE.Vector3((0.5 - lHand[9].x) * 25, (0.5 - lHand[9].y) * 18, 0);
          voxelGroup.position.copy(handWorldPos).add(grabOffset);
        }
      }

      // Right Hand Commands
      if (rHand) {
        const thumbTip = rHand[4], indexTip = rHand[8], midTip = rHand[12];
        const pinchingNow = getDist(thumbTip, indexTip) < pinchThreshold;
        const pointingNow = indexTip.y < rHand[6].y && midTip.y > rHand[10].y;
        const palmOpen = rHand[8].y < rHand[6].y && rHand[12].y < rHand[10].y && rHand[20].y < rHand[18].y;

        const isPeace = indexTip.y < rHand[6].y && midTip.y < rHand[10].y && rHand[16].y > rHand[14].y && rHand[20].y > rHand[18].y;
        if (isPeace) rainbowActive = true;
        else if (palmOpen) rainbowActive = false;

        const px = indexTip.x * bioCanvasRef.current.width, py = indexTip.y * bioCanvasRef.current.height;
        const worldPos = new THREE.Vector3((0.5 - indexTip.x) * 25, (0.5 - indexTip.y) * 18, 0);
        const localPos = voxelGroup.worldToLocal(worldPos.clone());

        let gx = Math.round(localPos.x / gridSize) * gridSize;
        let gy = Math.round(localPos.y / gridSize) * gridSize;
        let gz = 0;

        const lPinching = lHand && getDist(lHand[4], lHand[8]) < pinchThreshold;

        if (lPinching && pointingNow && !palmOpen) {
          buildTimer = 0;
          if (eraseTimer < INTENT_HOLD) {
            eraseTimer += 16;
            drawHUDCircle(bioCtx, px, py, eraseTimer / INTENT_HOLD, "#ff3333");
            setSysMode("INTENT: ERASER_LOCKING...");
          } else {
            isErasing = true;
            const key = `${gx.toFixed(1)},${gy.toFixed(1)},${gz.toFixed(1)}`;
            if (placedVoxels.has(key)) {
              voxelGroup.remove(placedVoxels.get(key));
              placedVoxels.delete(key);
              setVoxelCount(placedVoxels.size);
            }
            setSysMode("INTENT: ERASER_ACTIVE");
          }
        } else if (pinchingNow && !isGrabbing && !palmOpen) {
          eraseTimer = 0;
          if (buildTimer < INTENT_HOLD) {
            buildTimer += 16;
            drawHUDCircle(bioCtx, px, py, buildTimer / INTENT_HOLD, "#00ffcc");
            setSysMode("INTENT: BUILD_SYNCING...");
          } else {
            if (!isBuilding) { startPinchPos = { x: gx, y: gy, z: gz }; sketchKeys.clear(); isBuilding = true; activeAxis = null; }
            else {
              const dx = Math.abs(gx - startPinchPos.x), dy = Math.abs(gy - startPinchPos.y);
              if (!activeAxis && (dx > 0.4 || dy > 0.4)) {
                if (dx >= dy) activeAxis = 'x';
                else activeAxis = 'y';
              }
              let tx = startPinchPos.x, ty = startPinchPos.y;
              if (activeAxis === 'x') tx = gx; else if (activeAxis === 'y') ty = gy;
              addSketchVoxel(tx, ty, gz);
            }
            setSysMode("INTENT: BUILDING");
          }
        } else {
          if (palmOpen) { 
            if (isBuilding) commitVoxels(); 
            isBuilding = false; isErasing = false; buildTimer = 0; eraseTimer = 0; 
            setSysMode("BIO_LINK: NAVIGATING"); 
          }
        }

        if (isBuilding || buildTimer > 0 || isErasing || eraseTimer > 0) {
          crosshair.visible = true;
          crosshair.position.copy(voxelGroup.localToWorld(new THREE.Vector3(gx, gy, gz)));
          crosshair.material.color.set((isErasing || eraseTimer > 0) ? 0xff3333 : colorPalette[globalColorIndex]);
        }
      }
    };

    // --- E. INITIALIZE MEDIAPIPE TRACKING STRUCTURES ---
    const handsEngine = new window.Hands({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
    });
    handsEngine.setOptions({ maxNumHands: 2, modelComplexity: 1, minDetectionConfidence: 0.8, minTrackingConfidence: 0.8 });
    handsEngine.onResults(onResults);

    // --- F. OMNI-COMPATIBLE CAMERA STREAM WITH SIMULATOR FALLBACK ---
    let cameraStream = null;
    let fallbackInterval = null;

    const startCameraSystem = async () => {
      try {
        // Drop absolute facingMode constraints and test base configuration parameters
        cameraStream = new window.Camera(videoRef.current, {
          onFrame: async () => {
            if (videoRef.current && bioCanvasRef.current) {
              bioCanvasRef.current.width = videoRef.current.videoWidth;
              bioCanvasRef.current.height = videoRef.current.videoHeight;
              await handsEngine.send({ image: videoRef.current });
            }
          },
          width: 640,
          height: 480
        });
        
        await cameraStream.start();
        setSysMode("BIO_LINK: CHANNELS_OPEN");
      } catch (err) {
        console.warn("MediaPipe tracker failed parameter assignment. Falling back to native stream...", err);
        
        // Native Hardware Failover Intercept
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
          navigator.mediaDevices.getUserMedia({ video: true, audio: false })
            .then((stream) => {
              if (videoRef.current) {
                videoRef.current.srcObject = stream;
                
                const processNativeFrame = async () => {
                  if (!videoRef.current || videoRef.current.paused || videoRef.current.ended) return;
                  try { await handsEngine.send({ image: videoRef.current }); } catch (e) {}
                  requestAnimationFrame(processNativeFrame);
                };
                
                videoRef.current.onloadedmetadata = () => {
                  videoRef.current.play()
                    .then(() => {
                      requestAnimationFrame(processNativeFrame);
                      setSysMode("BIO_LINK: UNREGULATED_STREAM");
                    })
                    .catch(() => setSysMode("CRITICAL: VIDEO_PLAY_DENIED"));
                };
              }
            })
            .catch((nativeErr) => {
              console.error("Native hardware system completely uncommunicative. Bootstrapping SIMULATOR...", nativeErr);
              activateSimulatorMode();
            });
        } else {
          activateSimulatorMode();
        }
      }
    };

    // If native hardware is dead, start an internal rendering frame trigger so ThreeJS doesn't freeze
    const activateSimulatorMode = () => {
      setSysMode("DEV_MODE: SIMULATOR_ACTIVE (NO_HW_CAMERA)");
      
      if (bioCanvasRef.current) {
        bioCanvasRef.current.width = 640;
        bioCanvasRef.current.height = 480;
        const ctx = bioCanvasRef.current.getContext('2d');
        
        fallbackInterval = setInterval(() => {
          ctx.clearRect(0, 0, 640, 480);
          ctx.fillStyle = 'rgba(0, 240, 255, 0.1)';
          ctx.strokeStyle = '#00f0ff';
          ctx.lineWidth = 1;
          ctx.strokeRect(10, 10, 620, 460);
          ctx.fillStyle = '#00f0ff';
          ctx.font = '12px monospace';
          ctx.shadowBlur = 4;
          ctx.shadowColor = '#00f0ff';
          ctx.fillText("STATUS: CAMERA_HARDWARE_DISCONNECTED // MOCK_GRID_ONLINE", 25, 35);
        }, 100);
      }
    };

    // Stagger instantiation slightly to prevent thread locks while rendering canvas frames
    const startupDelay = setTimeout(startCameraSystem, 300);

    // --- G. RENDER ENGINE ANIMATION LOOP ---
    let animationFrameId;
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      if (rainbowActive) {
        placedVoxels.forEach(v => {
          v.material.emissive.setHSL(Math.random(), 1, 0.5);
          v.material.emissiveIntensity = 2.5;
        });
      } else {
        placedVoxels.forEach(v => {
          v.material.emissive.setHex(colorPalette[globalColorIndex]);
          v.material.emissiveIntensity = 0.4;
          v.children[0].material.color.setHex(colorPalette[globalColorIndex]);
        });
      }

      placedVoxels.forEach((v) => {
        if (gravityEnabled) {
          const worldPos = new THREE.Vector3();
          v.getWorldPosition(worldPos);
          const floorY = getFloorY();
          if (worldPos.y > floorY || v.velocity.y > 0) {
            v.velocity.y -= 0.025;
            v.position.add(v.velocity);
          } else if (!v.isBouncing) {
            const localFloor = voxelGroup.worldToLocal(new THREE.Vector3(0, floorY, 0));
            v.position.y = localFloor.y;
            v.velocity.y *= -0.15;
            v.velocity.x *= 0.5;
            v.isBouncing = true;
          } else { v.velocity.set(0, 0, 0); }
        } else {
          v.position.lerp(v.origin, 0.1);
          v.isBouncing = false;
        }
      });

      renderer.render(scene, camera);
    };
    animate();

    // --- H. COMPONENT TEARDOWN & GARBAGE COLLECTION ---
    return () => {
      clearTimeout(startupDelay);
      if (fallbackInterval) clearInterval(fallbackInterval);
      cancelAnimationFrame(animationFrameId);
      
      if (cameraStream && typeof cameraStream.stop === 'function') {
        cameraStream.stop();
      } else if (videoRef.current && videoRef.current.srcObject) {
        const tracks = videoRef.current.srcObject.getTracks();
        tracks.forEach(track => track.stop());
      }
      
      handsEngine.close();
      renderer.dispose();
    };
  }, []);

  // --- I. USER VIEWPORT PRESENTATION ---
  return (
    <div style={{ margin: 0, background: '#000', overflow: 'hidden', fontFamily: '"Courier New", monospace', width: '100vw', height: '100vh', position: 'relative' }}>
      
      {/* HUD Controller Diagnostics Panel */}
      <div style={{
        position: 'absolute', top: '20px', left: '20px', zIndex: 100,
        color: '#00f0ff', fontWeight: 'bold', fontSize: '14px',
        textShadow: '0 0 10px #00f0ff', borderLeft: '3px solid #00f0ff', paddingLeft: '15px',
        background: 'rgba(0,0,0,0.6)', padding: '15px'
      }}>
        <div>BIO_SYNC: ARCHITECT_OS_v5.2_VITE</div>
        <div>STATE: <span style={{ color: sysMode.includes('SIMULATOR') || sysMode.includes('ERROR') ? '#ffcc00' : '#fff' }}>{sysMode}</span></div>
        <div>VOXELS: <span style={{ color: '#fff' }}>{voxelCount}</span></div>
        <div style={{ fontSize: '10px', marginTop: '5px', color: '#ff3333' }}>2 FISTS: HOLD TO RESET | 2 PALMS: HOLD TO ROTATE</div>
        <div style={{ fontSize: '10px', color: '#ff00ff' }}>L-THUMB DOWN: BURST | L-THUMB UP: RESTORE</div>
        <div style={{ fontSize: '10px', color: '#00ff00' }}>L-VICTORY: TOGGLE COLOR | R-VICTORY: DISCO (PALM TO STOP)</div>
      </div>

      {/* Hardware Media Capture Node */}
      <video 
        ref={videoRef} 
        autoPlay 
        playsInline 
        style={{ position: 'absolute', width: '100vw', height: '100vh', objectFit: 'cover', transform: 'scaleX(-1)', zIndex: 1 }}
      />
      
      {/* WebGL Three.js Target Canvas */}
      <canvas 
        ref={threeCanvasRef} 
        style={{ position: 'absolute', top: 0, left: 0, zIndex: 5, pointerEvents: 'none', width: '100vw', height: '100vh' }}
      />
      
      {/* Biometric UI Tracker Superimposition Canvas */}
      <canvas 
        ref={bioCanvasRef} 
        style={{ position: 'absolute', width: '100vw', height: '100vh', zIndex: 10, transform: 'scaleX(-1)', pointerEvents: 'none' }}
      />
    </div>
  );
};

export default VoxelArchitect;  