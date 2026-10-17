import {useEffect, useRef} from 'react';
import {createBrushedMetalMaps} from './BrushedMetalTexture';

/** Imperative pointer coordinates avoid React renders while tilting the card. */
export interface MetalSurfaceController {
  setTilt(x: number, y: number): void;
  setGold(liked: boolean): void;
}

/**
 * Procedural brushed metal is the main image, augmented by subtle PBR HDR
 * reflections. Canvas and all GPU resources exist only while the lightbox
 * card is open; the DOM owns flip, text, focus and dismissal.
 *
 * The environment responds to CSS card tilt. It does not follow the pointer
 * as an independent spotlight.
 */
export function MetalBackCanvas({liked, onController}: {
  liked: boolean;
  onController(controller: MetalSurfaceController | null): void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const controller = useRef(onController);
  const materialHandle = useRef<MetalSurfaceController | null>(null);
  controller.current = onController;

  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    let disposed = false;
    let release: (() => void) | undefined;
    element.dataset.metalStatus = 'loading';

    const setup = async () => {
      const THREE = await import('three');
      const [{RGBELoader}, {RoomEnvironment}] = await Promise.all([
        import('three/addons/loaders/RGBELoader.js'),
        import('three/addons/environments/RoomEnvironment.js'),
      ]);
      if (disposed) return;
      element.dataset.metalStatus = 'initializing';

      let renderer: import('three').WebGLRenderer | undefined;
      try {
        renderer = new THREE.WebGLRenderer({
          canvas: element, alpha: true, antialias: true, powerPreference: 'low-power',
          preserveDrawingBuffer: false,
        });
      } catch {
        element.dataset.metalStatus = 'fallback';
        // WebGL unsupported, GPU unavailable, or browser context limit reached.
        return;
      }
      if (disposed) { renderer.dispose(); return; }

      element.dataset.metalStatus = 'renderer-ready';
      renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.25));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.18;
      renderer.setClearColor(0x000000, 0);

      const scene = new THREE.Scene();
      // Brushed texture is the main appearance; HDR is subtle supplemental
      // metal reflection, not a bright rectangular softbox.
      scene.environmentIntensity = 0.20;
      // PBR flat plates NEED a perspective view: orthographic rays have the
      // same direction at every pixel and thus sample the same HDR reflection.
      // Perspective makes the studio softboxes visible across a flat surface.
      const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 10);
      camera.position.z = 3;
      const geometry = new THREE.PlaneGeometry(2, 2);
      // One complete texture pair is allocated at a time. Toggling the
      // Album-level preference replaces and releases the previous maps.
      let brushedTone = liked;
      let brushed = createBrushedMetalMaps(THREE, liked ? 'gold' : 'silver');
      const material = new THREE.MeshPhysicalMaterial({
        map: brushed.color,
        roughnessMap: brushed.roughness,
        anisotropyMap: brushed.anisotropy,
        emissiveMap: brushed.color,
        color: 0xffffff,
        metalness: 1,
        roughness: 0.40,
        anisotropy: 0.48,
        anisotropyRotation: 0,
        envMapIntensity: 0.17,
        // A faint textured self-lit component preserves the visible brushed
        // sheet even when the HDR happens to face a dark studio direction.
        emissive: liked ? 0xb39c71 : 0xbcc9d9,
        emissiveIntensity: 1.12,
        side: THREE.FrontSide,
      });
      const plane = new THREE.Mesh(geometry, material);
      scene.add(plane);

      let hdr: import('three').DataTexture | undefined;
      let fallbackEnv: import('three').Texture | undefined;
      let fallbackPMREM: import('three').PMREMGenerator | undefined;
      let frame = 0;
      let resizeObserver: ResizeObserver | undefined;
      let currentX = 0;
      let currentY = 0;
      let targetX = 0;
      let targetY = 0;
      let active = true;
      let environmentTexture: import('three').Texture | undefined;

      const render = () => {
        if (!active || disposed) return;
        currentX += (targetX - currentX) * .16;
        currentY += (targetY - currentY) * .16;
        // Reflect the HDR studio light as the card tilts. Its apparent
        // movement comes from surface orientation, never cursor position.
        scene.environmentRotation.set(
          .26 + currentY * -1.1,
          -.54 + currentX * -1.35,
          -.06 + currentX * .13,
          'XYZ',
        );
        if (environmentTexture && element.clientWidth && element.clientHeight) {
          renderer.render(scene, camera);
          element.dataset.metalStatus = 'rendered';
        }
        if (Math.abs(targetX - currentX) > .0006 || Math.abs(targetY - currentY) > .0006)
          frame = requestAnimationFrame(render);
        else frame = 0;
      };
      const schedule = () => {
        if (!active || disposed || frame) return;
        frame = requestAnimationFrame(render);
      };
      const sizes = () => {
        if (!active || disposed) return;
        const width = Math.max(1, element.clientWidth);
        const height = Math.max(1, element.clientHeight);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        // Fill the viewport exactly, including while resizing on mobile.
        const halfHeight = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))
          * camera.position.z;
        plane.scale.set(halfHeight * camera.aspect, halfHeight, 1);
        renderer.setSize(width, height, false);
        schedule();
      };
      // Note: use the width/height from layout, not the DOM transform-bound
      // getBoundingClientRect(), which changes during the 3D flip.
      resizeObserver = new ResizeObserver(sizes);
      resizeObserver.observe(element);

      const api: MetalSurfaceController = {
        setGold(gold) {
          if (brushedTone !== gold) {
            const next = createBrushedMetalMaps(THREE, gold ? 'gold' : 'silver');
            const previous = brushed;
            brushed = next;
            brushedTone = gold;
            material.map = next.color;
            material.roughnessMap = next.roughness;
            material.anisotropyMap = next.anisotropy;
            material.emissiveMap = next.color;
            material.emissive.setHex(gold ? 0xb39c71 : 0xbcc9d9);
            material.needsUpdate = true;
            previous.dispose();
          }
          schedule();
        },
        setTilt(x,y) {
          targetX = Math.max(-.5, Math.min(.5, x));
          targetY = Math.max(-.5, Math.min(.5, y));
          schedule();
        },
      };
      materialHandle.current = api;
      controller.current(api);
      api.setGold(liked);
      sizes();

      // Register cleanup before awaiting HDR loading; navigation cannot leak WebGL.
      release = () => {
        active = false;
        materialHandle.current = null;
        controller.current(null);
        if (frame) cancelAnimationFrame(frame);
        resizeObserver?.disconnect();
        scene.environment = null;
        geometry.dispose();
        material.dispose();
        brushed.dispose();
        hdr?.dispose();
        fallbackEnv?.dispose();
        fallbackPMREM?.dispose();
        renderer.dispose();
        renderer.forceContextLoss();
      };

      const hdrLoader = new RGBELoader().setDataType(THREE.FloatType);
      try {
        // Bundled locally: an album card must never depend on a remote asset.
        const texture = await hdrLoader.loadAsync('/metal/studio_small_05_1k.hdr');
        if (disposed || !active) { texture.dispose(); return; }
        // Keep the HDR photographic lighting intact, at deliberately low
        // intensity. The image's highlights are no longer the main design.
        // No cursor spotlight or synthetic rectangular lighting is created.
        texture.mapping = THREE.EquirectangularReflectionMapping;
        hdr = texture;
        environmentTexture = texture;
        scene.environment = environmentTexture;
        element.dataset.metalStatus = 'hdr-ready';
        schedule();
      } catch {
        if (disposed || !active) return;
        // Procedural studio lights, also works without network access.
        fallbackPMREM = new THREE.PMREMGenerator(renderer);
        const room = new RoomEnvironment();
        fallbackEnv = fallbackPMREM.fromScene(room).texture;
        room.dispose();
        environmentTexture = fallbackEnv;
        scene.environment = fallbackEnv;
        element.dataset.metalStatus = 'room-ready';
        schedule();
      }

    };
    void setup().catch(error => {
      // CSS fallback stays visible if material initialization fails.
      if (!disposed) {
        element.dataset.metalStatus = 'fallback';
        console.warn('Metal material unavailable:', error);
      }
    });
    return () => {
      disposed = true;
      materialHandle.current = null;
      controller.current(null);
      release?.();
    };
  }, []);

  useEffect(() => {
    // Updating liked never allocates another WebGL context or reloads the HDR.
    materialHandle.current?.setGold(liked);
  }, [liked]);

  return <canvas ref={canvas} className="album-metal-canvas"
    data-metal-tone={liked ? 'gold' : 'silver'} aria-hidden="true"/>;
}
