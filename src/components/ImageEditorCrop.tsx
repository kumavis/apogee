import React, { useState, useRef, useCallback } from 'react';
import ReactCrop, { 
  Crop, 
  PixelCrop,
  centerCrop,
  makeAspectCrop
} from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';

type ImageEditorCropProps = {
  onImageChange: (dataUri: string | null) => void;
  initialImage?: string | null;
  width?: number;
  height?: number;
};

const ImageEditorCrop: React.FC<ImageEditorCropProps> = ({ 
  onImageChange, 
  initialImage = null,
  width = 336,
  height = 180
}) => {
  const [imgSrc, setImgSrc] = useState<string>('');
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const [mode, setMode] = useState<'crop' | 'draw'>('crop');
  const [isDrawing, setIsDrawing] = useState(false);
  const [brushSize, setBrushSize] = useState(3);
  const [brushColor, setBrushColor] = useState('#ffffff');
  const [lastPoint, setLastPoint] = useState<{ x: number; y: number } | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingCanvasRef = useRef<HTMLCanvasElement>(null);

  // Calculate aspect ratio from desired dimensions
  const aspect = width / height; // 336/180 = 1.867

  const onSelectFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setCrop(undefined); // Makes crop preview update between images.
      const reader = new FileReader();
      reader.addEventListener('load', () =>
        setImgSrc(reader.result?.toString() || '')
      );
      reader.readAsDataURL(e.target.files[0]);
    }
  };

  const onImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const { naturalWidth: imgWidth, naturalHeight: imgHeight } = e.currentTarget;

    // For existing images (initialImage), start with 100% crop
    // For new images, create a crop that fits the target aspect ratio
    if (initialImage && imgSrc === initialImage) {
      // Start with 100% of the image when editing existing card
      const fullCrop: Crop = {
        unit: '%',
        x: 0,
        y: 0,
        width: 100,
        height: 100,
      };
      setCrop(fullCrop);
    } else {
      // Create a centered crop with our target aspect ratio for new images
      const initialCrop = centerCrop(
        makeAspectCrop(
          {
            unit: '%',
            width: 90, // Use 90% of the image width initially
          },
          aspect,
          imgWidth,
          imgHeight
        ),
        imgWidth,
        imgHeight
      );
      setCrop(initialCrop);
    }
  };

  const generateCroppedImage = useCallback(async () => {
    const image = imgRef.current;
    const canvas = canvasRef.current;
    const crop = completedCrop;

    if (!image || !canvas || !crop) {
      return;
    }

    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;

    const offscreen = new OffscreenCanvas(width, height);
    const ctx = offscreen.getContext('2d');

    if (!ctx) {
      return;
    }

    // Draw the cropped image to match our exact dimensions
    ctx.drawImage(
      image,
      crop.x * scaleX,
      crop.y * scaleY,
      crop.width * scaleX,
      crop.height * scaleY,
      0,
      0,
      width,
      height
    );

    // Convert to blob and then to data URI
    const blob = await offscreen.convertToBlob({ type: 'image/png' });
    const reader = new FileReader();
    reader.onload = () => {
      onImageChange(reader.result as string);
    };
    reader.readAsDataURL(blob);
  }, [completedCrop, width, height, onImageChange]);

  const generateDrawingImage = useCallback(() => {
    const canvas = drawingCanvasRef.current;
    if (!canvas) return;
    
    const dataUri = canvas.toDataURL('image/png');
    onImageChange(dataUri);
  }, [onImageChange]);

  // Drawing event handlers
  const handleDrawingMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (mode !== 'draw') return;
    
    const canvas = drawingCanvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setIsDrawing(true);
    setLastPoint({ x, y });
  };

  const handleDrawingMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || mode !== 'draw' || !lastPoint) return;

    const canvas = drawingCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Draw line from last point to current point
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = brushColor;
    ctx.lineWidth = brushSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.beginPath();
    ctx.moveTo(lastPoint.x, lastPoint.y);
    ctx.lineTo(x, y);
    ctx.stroke();

    setLastPoint({ x, y });
  };

  const handleDrawingMouseUp = () => {
    if (mode !== 'draw') return;
    
    setIsDrawing(false);
    setLastPoint(null);
    
    // Update the image immediately after drawing
    generateDrawingImage();
  };

  const handlePaste = useCallback(async (e: ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of items) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (!file) continue;

        setCrop(undefined);
        const reader = new FileReader();
        reader.addEventListener('load', () =>
          setImgSrc(reader.result?.toString() || '')
        );
        reader.readAsDataURL(file);
        break;
      }
    }
  }, []);

  const createBlankCanvas = () => {
    const canvas = drawingCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Fill with white background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    // Switch to draw mode and clear other state
    setMode('draw');
    setImgSrc('');
    setCrop(undefined);
    setCompletedCrop(undefined);
    setDrawCanvasInitialized(true); // Mark as initialized since we just set it up
    
    // Notify parent of the blank canvas
    generateDrawingImage();
  };

  const handleClear = () => {
    setImgSrc('');
    setCrop(undefined);
    setCompletedCrop(undefined);
    setMode('crop');
    setDrawCanvasInitialized(false); // Reset initialization flag
    
    // Clear drawing canvas
    const canvas = drawingCanvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, width, height);
      }
    }
    
    onImageChange(null);
  };

  // Set up global paste event listener
  React.useEffect(() => {
    const handleGlobalPaste = (e: ClipboardEvent) => {
      // Only handle paste if no other input is focused
      if (document.activeElement?.tagName === 'INPUT' || 
          document.activeElement?.tagName === 'TEXTAREA') {
        return;
      }
      handlePaste(e);
    };

    document.addEventListener('paste', handleGlobalPaste);
    return () => document.removeEventListener('paste', handleGlobalPaste);
  }, [handlePaste]);

  // Load initial image if provided - simple and clean
  React.useEffect(() => {
    if (initialImage && !imgSrc) {
      setImgSrc(initialImage);
    }
  }, [initialImage, imgSrc]);

  // Initialize drawing canvas ONLY when first switching to draw mode
  const [drawCanvasInitialized, setDrawCanvasInitialized] = React.useState(false);
  
  React.useEffect(() => {
    if (mode === 'draw' && !drawCanvasInitialized) {
      const canvas = drawingCanvasRef.current;
      if (!canvas) return;

      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Create blank white canvas by default
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);

      // If we have an initial image and we're in draw mode, load it
      if (initialImage) {
        const img = new Image();
        img.onload = () => {
          ctx.drawImage(img, 0, 0, width, height);
        };
        img.src = initialImage;
      }
      
      setDrawCanvasInitialized(true);
    }
    
    // Reset initialization flag when leaving draw mode
    if (mode !== 'draw') {
      setDrawCanvasInitialized(false);
    }
  }, [mode, width, height, initialImage, drawCanvasInitialized]);

  // Generate cropped image when crop changes
  React.useEffect(() => {
    if (completedCrop && imgRef.current) {
      generateCroppedImage();
    }
  }, [completedCrop, generateCroppedImage]);

  return (
    <div style={{
      background: 'rgba(0,0,0,0.3)',
      border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: 8,
      padding: 16
    }}>
      <h4 style={{ 
        margin: '0 0 12px 0', 
        color: '#00ffff', 
        fontSize: 16 
      }}>
        🎨 Card Image Editor
      </h4>
      
      <p style={{
        fontSize: 12,
        color: '#888',
        margin: '0 0 12px 0',
        textAlign: 'center'
      }}>
        Upload/paste images, crop to size, or draw artwork ({width}×{height}px)
      </p>

      {/* Mode Toggle */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 8,
        marginBottom: 16,
        padding: '4px',
        background: 'rgba(0,0,0,0.3)',
        borderRadius: 6
      }}>
        <button
          onClick={() => setMode('crop')}
          style={{
            padding: '8px 12px',
            background: mode === 'crop' ? 'rgba(0,255,255,0.3)' : 'transparent',
            border: mode === 'crop' ? '1px solid rgba(0,255,255,0.5)' : '1px solid transparent',
            borderRadius: 4,
            color: mode === 'crop' ? '#00ffff' : '#ccc',
            fontSize: 12,
            cursor: 'pointer',
            transition: 'all 0.2s ease'
          }}
        >
          ✂️ Crop Mode
        </button>
        <button
          onClick={() => setMode('draw')}
          style={{
            padding: '8px 12px',
            background: mode === 'draw' ? 'rgba(255,165,0,0.3)' : 'transparent',
            border: mode === 'draw' ? '1px solid rgba(255,165,0,0.5)' : '1px solid transparent',
            borderRadius: 4,
            color: mode === 'draw' ? '#ffaa00' : '#ccc',
            fontSize: 12,
            cursor: 'pointer',
            transition: 'all 0.2s ease'
          }}
        >
          ✏️ Draw Mode
        </button>
      </div>

      {/* File Upload */}
      <div style={{ marginBottom: 16 }}>
        <label style={{
          display: 'block',
          padding: '12px',
          background: 'rgba(0,255,255,0.2)',
          border: '2px dashed rgba(0,255,255,0.4)',
          borderRadius: 8,
          color: '#00ffff',
          fontSize: 14,
          textAlign: 'center',
          cursor: 'pointer',
          transition: 'all 0.2s ease'
        }}>
          📁 Upload Image or Paste (Ctrl+V)
          <input
            type="file"
            accept="image/*"
            onChange={onSelectFile}
            style={{ display: 'none' }}
          />
        </label>
      </div>

      {/* Drawing Controls */}
      {mode === 'draw' && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 8,
          marginBottom: 16,
          padding: 12,
          background: 'rgba(255,165,0,0.05)',
          border: '1px solid rgba(255,165,0,0.3)',
          borderRadius: 8
        }}>
          {/* Brush Size */}
          <div>
            <label style={{ 
              display: 'block', 
              fontSize: 11, 
              color: '#ffaa00', 
              marginBottom: 4 
            }}>
              Brush Size: {brushSize}px
            </label>
            <input
              type="range"
              min="1"
              max="20"
              value={brushSize}
              onChange={(e) => setBrushSize(parseInt(e.target.value))}
              style={{
                width: '100%',
                accentColor: '#ffaa00'
              }}
            />
          </div>

          {/* Brush Color */}
          <div>
            <label style={{ 
              display: 'block', 
              fontSize: 11, 
              color: '#ffaa00', 
              marginBottom: 4 
            }}>
              Brush Color
            </label>
            <input
              type="color"
              value={brushColor}
              onChange={(e) => setBrushColor(e.target.value)}
              style={{
                width: '100%',
                height: 30,
                border: 'none',
                borderRadius: 4,
                cursor: 'pointer'
              }}
            />
          </div>
        </div>
      )}

      {/* Drawing Canvas */}
      {mode === 'draw' && (
        <div style={{
          border: '2px solid #ffaa00',
          borderRadius: 4,
          marginBottom: 16,
          background: '#fff'
        }}>
          <canvas
            ref={drawingCanvasRef}
            width={width}
            height={height}
            style={{
              display: 'block',
              cursor: mode === 'draw' ? 'crosshair' : 'default',
              borderRadius: 4
            }}
            onMouseDown={handleDrawingMouseDown}
            onMouseMove={handleDrawingMouseMove}
            onMouseUp={handleDrawingMouseUp}
            onMouseLeave={handleDrawingMouseUp}
          />
        </div>
      )}

      {/* Crop Interface */}
      {mode === 'crop' && imgSrc && (
        <div style={{ marginBottom: 16 }}>
          <ReactCrop
            crop={crop}
            onChange={(_, percentCrop) => setCrop(percentCrop)}
            onComplete={(c) => setCompletedCrop(c)}
            aspect={aspect}
            style={{
              maxWidth: '100%',
              borderRadius: 4
            }}
          >
            <img
              ref={imgRef}
              alt="Crop me"
              src={imgSrc}
              style={{ 
                maxWidth: '100%', 
                height: 'auto',
                borderRadius: 4
              }}
              onLoad={onImageLoad}
            />
          </ReactCrop>
        </div>
      )}

      {/* Hidden canvas for image processing */}
      <canvas
        ref={canvasRef}
        style={{ display: 'none' }}
        width={width}
        height={height}
      />

      {/* Action Buttons */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: mode === 'draw' ? '1fr 1fr 1fr' : '1fr 1fr',
        gap: 8
      }}>
        {/* Create Blank Canvas (Draw Mode Only) */}
        {mode === 'draw' && (
          <button
            onClick={createBlankCanvas}
            style={{
              padding: '8px 12px',
              background: 'rgba(255,165,0,0.2)',
              border: '1px solid rgba(255,165,0,0.4)',
              borderRadius: 4,
              color: '#ffaa00',
              fontSize: 12,
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            📄 New Canvas
          </button>
        )}

        {/* Apply Crop (Crop Mode Only) */}
        {mode === 'crop' && (
          <button
            onClick={generateCroppedImage}
            disabled={!completedCrop}
            style={{
              padding: '8px 12px',
              background: completedCrop ? 'rgba(0,255,0,0.2)' : 'rgba(100,100,100,0.2)',
              border: `1px solid ${completedCrop ? 'rgba(0,255,0,0.4)' : 'rgba(100,100,100,0.4)'}`,
              borderRadius: 4,
              color: completedCrop ? '#00ff00' : '#666',
              fontSize: 12,
              cursor: completedCrop ? 'pointer' : 'not-allowed',
              transition: 'all 0.2s ease'
            }}
          >
            ✅ Apply Crop
          </button>
        )}

        {/* Load Image to Draw On (Draw Mode Only) */}
        {mode === 'draw' && imgSrc && (
          <button
            onClick={() => {
              const canvas = drawingCanvasRef.current;
              if (!canvas) return;

              // Clear the canvas first
              const ctx = canvas.getContext('2d');
              if (!ctx) return;
              
              ctx.clearRect(0, 0, width, height);
              canvas.width = width;
              canvas.height = height;

              const img = new Image();
              img.onload = () => {
                ctx.drawImage(img, 0, 0, width, height);
                generateDrawingImage();
              };
              img.src = imgSrc;
            }}
            style={{
              padding: '8px 12px',
              background: 'rgba(0,255,255,0.2)',
              border: '1px solid rgba(0,255,255,0.4)',
              borderRadius: 4,
              color: '#00ffff',
              fontSize: 12,
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            🖼️ Load Image
          </button>
        )}

        {/* Clear */}
        <button
          onClick={handleClear}
          style={{
            padding: '8px 12px',
            background: 'rgba(255,68,68,0.2)',
            border: '1px solid rgba(255,68,68,0.4)',
            borderRadius: 4,
            color: '#ff4444',
            fontSize: 12,
            cursor: 'pointer',
            transition: 'all 0.2s ease'
          }}
        >
          🗑️ Clear
        </button>
      </div>

      <p style={{
        fontSize: 11,
        color: '#888',
        margin: '8px 0 0 0',
        textAlign: 'center'
      }}>
        {mode === 'crop' 
          ? 'Upload images • Paste with Ctrl+V • Crop to fit card dimensions'
          : 'Draw with mouse • Create blank canvas • Load images to draw on'
        }
      </p>
    </div>
  );
};

export default ImageEditorCrop;
