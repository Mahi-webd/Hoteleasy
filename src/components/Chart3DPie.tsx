
import React, { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Text } from '@react-three/drei';
import * as THREE from 'three';

interface PieSliceProps {
  startAngle: number;
  endAngle: number;
  radius: number;
  height: number;
  color: string;
  position: [number, number, number];
}

const PieSlice: React.FC<PieSliceProps> = ({ startAngle, endAngle, radius, height, color, position }) => {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame(() => {
    if (meshRef.current) {
      meshRef.current.rotation.y += 0.005;
    }
  });

  const createSliceGeometry = () => {
    const geometry = new THREE.CylinderGeometry(radius, radius, height, 32, 1, false, startAngle, endAngle - startAngle);
    return geometry;
  };

  return (
    <mesh ref={meshRef} position={position} geometry={createSliceGeometry()}>
      <meshPhongMaterial color={color} />
    </mesh>
  );
};

interface Chart3DPieProps {
  data: Array<{
    name: string;
    value: number;
    revenue: number;
    color: string;
  }>;
}

const Chart3DPie: React.FC<Chart3DPieProps> = ({ data }) => {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  let currentAngle = 0;

  const slices = data.map((item, index) => {
    const angle = (item.value / total) * Math.PI * 2;
    const startAngle = currentAngle;
    const endAngle = currentAngle + angle;
    const middleAngle = startAngle + angle / 2;
    
    // Calculate position for slight separation
    const separationDistance = 0.1;
    const x = Math.cos(middleAngle) * separationDistance;
    const z = Math.sin(middleAngle) * separationDistance;
    
    currentAngle = endAngle;
    
    return {
      ...item,
      startAngle,
      endAngle,
      position: [x, 0, z] as [number, number, number]
    };
  });

  return (
    <div className="w-full h-64">
      <Canvas camera={{ position: [0, 2, 5], fov: 50 }}>
        <ambientLight intensity={0.6} />
        <pointLight position={[10, 10, 10]} intensity={1} />
        <pointLight position={[-10, -10, -10]} intensity={0.5} />
        
        {slices.map((slice, index) => (
          <PieSlice
            key={index}
            startAngle={slice.startAngle}
            endAngle={slice.endAngle}
            radius={1.5}
            height={0.8}
            color={slice.color}
            position={slice.position}
          />
        ))}
        
        <OrbitControls enableZoom={true} enablePan={false} />
      </Canvas>
    </div>
  );
};

export default Chart3DPie;
