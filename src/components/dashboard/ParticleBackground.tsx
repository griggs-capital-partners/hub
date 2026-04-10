"use client";

import React, { useEffect, useRef } from "react";
import * as THREE from "three";

export function ParticleBackground() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    
    // Scene setup
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    camera.position.z = 5;

    const renderer = new THREE.WebGLRenderer({ 
      alpha: true, 
      antialias: true 
    });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    container.appendChild(renderer.domElement);

    // Plexus Configuration (Refined visibility)
    const nodeCount = 100;
    const maxDistance = 2.5; // Distance to connect nodes
    const driftSpeed = 0.003; // Base drift speed (slow and professional)
    const particlePositions = new Float32Array(nodeCount * 3);
    const particleVelocities: THREE.Vector3[] = [];

    // Initialize nodes and velocities
    for (let i = 0; i < nodeCount; i++) {
        // Position within a 12x12x12 cube
        particlePositions[i * 3] = (Math.random() - 0.5) * 12;
        particlePositions[i * 3 + 1] = (Math.random() - 0.5) * 12;
        particlePositions[i * 3 + 2] = (Math.random() - 0.5) * 12;

        // Random velocity vector
        particleVelocities.push(
            new THREE.Vector3(
                (Math.random() - 0.5) * driftSpeed,
                (Math.random() - 0.5) * driftSpeed,
                (Math.random() - 0.5) * driftSpeed
            )
        );
    }

    const nodeGeometry = new THREE.BufferGeometry();
    nodeGeometry.setAttribute("position", new THREE.BufferAttribute(particlePositions, 3));

    // Create a smooth circular texture for the nodes
    const nodeCanvas = document.createElement("canvas");
    nodeCanvas.width = 64;
    nodeCanvas.height = 64;
    const nodeCtx = nodeCanvas.getContext("2d");
    if (nodeCtx) {
      const gradient = nodeCtx.createRadialGradient(32, 32, 0, 32, 32, 32);
      gradient.addColorStop(0, "rgba(255, 255, 255, 1)");
      gradient.addColorStop(0.4, "rgba(255, 255, 255, 0.4)");
      gradient.addColorStop(1, "rgba(255, 255, 255, 0)");
      nodeCtx.fillStyle = gradient;
      nodeCtx.fillRect(0, 0, 64, 64);
    }
    const nodeTexture = new THREE.CanvasTexture(nodeCanvas);

    // Points Material (Nodes)
    const nodeMaterial = new THREE.PointsMaterial({
      size: 0.05,
      color: new THREE.Color("#F7941D"),
      map: nodeTexture,
      transparent: true,
      opacity: 0.6, // Increased visibility
      sizeAttenuation: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    const nodeMesh = new THREE.Points(nodeGeometry, nodeMaterial);
    scene.add(nodeMesh);

    // Line Geometry (Connections)
    const maxConnections = nodeCount * 5;
    const linePositions = new Float32Array(maxConnections * 2 * 3);
    const lineOpacities = new Float32Array(maxConnections * 2);

    const lineGeometry = new THREE.BufferGeometry();
    lineGeometry.setAttribute("position", new THREE.BufferAttribute(linePositions, 3));
    lineGeometry.setAttribute("opacity", new THREE.BufferAttribute(lineOpacities, 1));

    const lineMaterial = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        color: { value: new THREE.Color("#F7941D") },
      },
      vertexShader: `
        attribute float opacity;
        varying float vOpacity;
        void main() {
          vOpacity = opacity;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 color;
        varying float vOpacity;
        void main() {
          gl_FragColor = vec4(color, vOpacity);
        }
      `,
    });

    const lineMesh = new THREE.LineSegments(lineGeometry, lineMaterial);
    scene.add(lineMesh);

    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };

    window.addEventListener("resize", handleResize);

    // Animation loop
    const animate = () => {
      requestAnimationFrame(animate);

      const positions = nodeGeometry.attributes.position.array as Float32Array;
      
      for (let i = 0; i < nodeCount; i++) {
          // Apply velocity (pure drift now)
          positions[i * 3] += particleVelocities[i].x;
          positions[i * 3 + 1] += particleVelocities[i].y;
          positions[i * 3 + 2] += particleVelocities[i].z;

          // Wrap around with soft bounds
          if (positions[i * 3] > 6 || positions[i * 3] < -6) particleVelocities[i].x *= -1;
          if (positions[i * 3 + 1] > 6 || positions[i * 3 + 1] < -6) particleVelocities[i].y *= -1;
          if (positions[i * 3 + 2] > 6 || positions[i * 3 + 2] < -6) particleVelocities[i].z *= -1;
      }
      nodeGeometry.attributes.position.needsUpdate = true;

      // Update connections
      let vertexIdx = 0;
      let opacityIdx = 0;

      for (let i = 0; i < nodeCount; i++) {
          for (let j = i + 1; j < nodeCount; j++) {
              const dx = positions[i * 3] - positions[j * 3];
              const dy = positions[i * 3 + 1] - positions[j * 3 + 1];
              const dz = positions[i * 3 + 2] - positions[j * 3 + 2];
              const distSq = dx * dx + dy * dy + dz * dz;

              if (distSq < maxDistance * maxDistance && vertexIdx < linePositions.length) {
                  const dist = Math.sqrt(distSq);
                  const opacity = 1 - dist / maxDistance;

                  linePositions[vertexIdx++] = positions[i * 3];
                  linePositions[vertexIdx++] = positions[i * 3 + 1];
                  linePositions[vertexIdx++] = positions[i * 3 + 2];
                  lineOpacities[opacityIdx++] = opacity * 0.4; // Boosted line visibility

                  linePositions[vertexIdx++] = positions[j * 3];
                  linePositions[vertexIdx++] = positions[j * 3 + 1];
                  linePositions[vertexIdx++] = positions[j * 3 + 2];
                  lineOpacities[opacityIdx++] = opacity * 0.4;
              }
          }
      }

      lineGeometry.setDrawRange(0, vertexIdx / 3);
      lineGeometry.attributes.position.needsUpdate = true;
      lineGeometry.attributes.opacity.needsUpdate = true;

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      window.removeEventListener("resize", handleResize);
      container.removeChild(renderer.domElement);
      nodeGeometry.dispose();
      nodeMaterial.dispose();
      lineGeometry.dispose();
      lineMaterial.dispose();
      renderer.dispose();
    };
  }, []);

  return (
    <div 
      ref={containerRef} 
      className="fixed inset-0 pointer-events-none z-0"
      aria-hidden="true"
    />
  );
}
