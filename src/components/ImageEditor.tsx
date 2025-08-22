import React, { useState, useRef, useCallback } from 'react';
import ReactCrop, { 
  Crop, 
  PixelCrop,
  centerCrop,
  makeAspectCrop
} from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';

type Tool = 'draw' | 'erase' | 'crop';

type ImageEditorProps = {
  onImageChange: (dataUri: string | null) => void;
  initialImage?: string | null;
  width?: number;
  height?: number;
  showUndoButton?: boolean;
  onUndo?: () => void;
};

const ImageEditor: React.FC<ImageEditorProps> = ({ 
  onImageChange, 
  initialImage = null,
  width = 240,
  height = 336,
  showUndoButton = false,
  onUndo
}) => {
  const [imgSrc, setImgSrc] = useState<string>('');
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const [selectedTool, setSelectedTool] = useState<Tool>('draw');
  const [isDrawing, setIsDrawing] = useState(false);
  const [brushSize, setBrushSize] = useState(3);
  const [brushColor, setBrushColor] = useState('#ffffff');
  const [lastPoint, setLastPoint] = useState<{ x: number; y: number } | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);
  const [isHovering, setIsHovering] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingCanvasRef = useRef<HTMLCanvasElement>(null);

  // Initialize drawing canvas state
  const [drawCanvasInitialized, setDrawCanvasInitialized] = React.useState(false);

  // Calculate aspect ratio from desired dimensions
  const aspect = width / height;

  const onSelectFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const reader = new FileReader();
      reader.addEventListener('load', () => {
        const imageUrl = reader.result?.toString() || '';
        setImgSrc(imageUrl);
        // Switch to crop tool when loading an image
        setSelectedTool('crop');
      });
      reader.readAsDataURL(e.target.files[0]);
    }
  };

  const onImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const { naturalWidth: imgWidth, naturalHeight: imgHeight } = e.currentTarget;

    // Always start with full crop that matches card aspect ratio
    const fullCrop = centerCrop(
      makeAspectCrop(
        {
          unit: '%',
          width: 100,
        },
        aspect,
        imgWidth,
        imgHeight
      ),
      imgWidth,
      imgHeight
    );
    setCrop(fullCrop);
    setCompletedCrop({
      unit: 'px',
      x: fullCrop.x * imgWidth / 100,
      y: fullCrop.y * imgHeight / 100,
      width: fullCrop.width * imgWidth / 100,
      height: fullCrop.height * imgHeight / 100
    });
  };

  const generateCroppedImage = useCallback(async () => {
    const image = imgRef.current;
    const canvas = canvasRef.current;
    const drawingCanvas = drawingCanvasRef.current;
    const crop = completedCrop;

    if (!image || !canvas || !crop || !drawingCanvas) {
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
      const croppedDataUri = reader.result as string;
      
      // Load the cropped image onto the drawing canvas
      const drawCtx = drawingCanvas.getContext('2d');
      if (drawCtx) {
        const img = new Image();
        img.onload = () => {
          drawCtx.clearRect(0, 0, width, height);
          drawCtx.drawImage(img, 0, 0, width, height);
          // Switch to draw tool and notify parent
          setSelectedTool('draw');
          const dataUri = drawingCanvas.toDataURL('image/png');
          onImageChange(dataUri);
        };
        img.src = croppedDataUri;
      }
      
      onImageChange(croppedDataUri);
    };
    reader.readAsDataURL(blob);
  }, [completedCrop, width, height, onImageChange]);



  // Drawing event handlers
  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (selectedTool !== 'draw' && selectedTool !== 'erase') return;
    
    const canvas = drawingCanvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    setIsDrawing(true);
    setLastPoint({ x, y });

    // Draw a dot at the starting point for single clicks
    const ctx = canvas.getContext('2d');
    if (ctx) {
      if (selectedTool === 'erase') {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.lineWidth = brushSize;
      } else {
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = brushColor;
        ctx.lineWidth = brushSize;
      }
      
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      
      ctx.beginPath();
      ctx.arc(x, y, ctx.lineWidth / 2, 0, 2 * Math.PI);
      ctx.fill();
      if (selectedTool === 'draw') {
        ctx.fillStyle = brushColor;
      }
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = drawingCanvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    // Only draw if we're actively drawing
    if (isDrawing && (selectedTool === 'draw' || selectedTool === 'erase') && lastPoint) {
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Set up drawing/erasing context
      if (selectedTool === 'erase') {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.lineWidth = brushSize;
      } else {
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = brushColor;
        ctx.lineWidth = brushSize;
      }
      
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      ctx.beginPath();
      ctx.moveTo(lastPoint.x, lastPoint.y);
      ctx.lineTo(x, y);
      ctx.stroke();

      setLastPoint({ x, y });
    }
  };

  const handleCanvasMouseUp = () => {
    if (selectedTool !== 'draw' && selectedTool !== 'erase') return;
    
    setIsDrawing(false);
    setLastPoint(null);
    
    // Update the image immediately after drawing/erasing
    const canvas = drawingCanvasRef.current;
    if (canvas) {
      const dataUri = canvas.toDataURL('image/png');
      onImageChange(dataUri);
    }
  };

  const handleCanvasMouseEnter = () => {
    if (selectedTool === 'draw' || selectedTool === 'erase') {
      setIsHovering(true);
    }
  };

  const handleCanvasMouseLeave = () => {
    setIsHovering(false);
    setMousePos(null);
  };

  const handleCanvasMouseHover = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isHovering || (selectedTool !== 'draw' && selectedTool !== 'erase')) return;

    const canvas = drawingCanvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setMousePos({ x, y });
  };

  const handlePaste = useCallback(async (e: ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of items) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (!file) continue;

        const reader = new FileReader();
        reader.addEventListener('load', () => {
          const imageUrl = reader.result?.toString() || '';
          setImgSrc(imageUrl);
          // Switch to crop tool when pasting an image
          setSelectedTool('crop');
        });
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

    // Switch to draw tool and clear other state
    setSelectedTool('draw');
    setImgSrc('');
    setCrop(undefined);
    setCompletedCrop(undefined);
    
    // Notify parent of the blank canvas
    const dataUri = canvas.toDataURL('image/png');
    onImageChange(dataUri);
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

  // Initialize drawing canvas only once
  React.useEffect(() => {
    if (!drawCanvasInitialized) {
      const canvas = drawingCanvasRef.current;
      if (!canvas) return;

      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Create blank white canvas by default
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);

      // If we have an initial image, load it
      if (initialImage) {
        const img = new Image();
        img.onload = () => {
          ctx.clearRect(0, 0, width, height);
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);
          // Notify parent of current state
          const dataUri = canvas.toDataURL('image/png');
          onImageChange(dataUri);
        };
        img.src = initialImage;
        setImgSrc(initialImage);
      } else {
        // Notify parent of blank canvas
        const dataUri = canvas.toDataURL('image/png');
        onImageChange(dataUri);
      }
      
      setDrawCanvasInitialized(true);
    }
  }, [width, height, drawCanvasInitialized, initialImage, onImageChange]);

  return (
    <>
      <style>
        {`
          @keyframes dash {
            0% { border-color: rgba(0,0,0,0.8); }
            50% { border-color: rgba(255,255,255,0.8); }
            100% { border-color: rgba(0,0,0,0.8); }
          }
        `}
      </style>
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
        Draw artwork, crop images, and create card art ({width}×{height}px)
      </p>

      {/* Drawing Tools */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr 1fr',
        gap: 8,
        marginBottom: 16,
        padding: '8px',
        background: 'rgba(0,0,0,0.3)',
        borderRadius: 6
      }}>
        <button
          onClick={() => setSelectedTool('draw')}
          style={{
            padding: '10px 8px',
            background: selectedTool === 'draw' ? 'rgba(255,165,0,0.3)' : 'transparent',
            border: selectedTool === 'draw' ? '2px solid rgba(255,165,0,0.5)' : '2px solid rgba(255,255,255,0.2)',
            borderRadius: 6,
            color: selectedTool === 'draw' ? '#ffaa00' : '#ccc',
            fontSize: 11,
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            fontWeight: 600
          }}
        >
          🖌️ Draw
        </button>
        <button
          onClick={() => setSelectedTool('erase')}
          style={{
            padding: '10px 8px',
            background: selectedTool === 'erase' ? 'rgba(255,100,100,0.3)' : 'transparent',
            border: selectedTool === 'erase' ? '2px solid rgba(255,100,100,0.5)' : '2px solid rgba(255,255,255,0.2)',
            borderRadius: 6,
            color: selectedTool === 'erase' ? '#ff6666' : '#ccc',
            fontSize: 11,
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            fontWeight: 600
          }}
        >
          🧽 Erase
        </button>
        <button
          onClick={() => setSelectedTool('crop')}
          style={{
            padding: '10px 8px',
            background: selectedTool === 'crop' ? 'rgba(0,255,255,0.3)' : 'transparent',
            border: selectedTool === 'crop' ? '2px solid rgba(0,255,255,0.5)' : '2px solid rgba(255,255,255,0.2)',
            borderRadius: 6,
            color: selectedTool === 'crop' ? '#00ffff' : '#ccc',
            fontSize: 11,
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            fontWeight: 600
          }}
        >
          ✂️ Crop
        </button>
      </div>

      {/* Tool Description */}
      <p style={{
        fontSize: 11,
        color: '#888',
        margin: '8px 0 16px 0',
        textAlign: 'center'
      }}>
        {selectedTool === 'draw' 
          ? '🖌️ Draw directly on canvas • Upload/paste images to crop and draw over' 
          : selectedTool === 'erase'
          ? '🧽 Erase parts of your artwork • Upload/paste images to crop and add'
          : '✂️ Upload/paste images then select area to crop to canvas'
        }
      </p>

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

      {/* Persistent Controls */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr auto',
        gap: 8,
        marginBottom: 16,
        padding: 12,
        background: 'rgba(255,165,0,0.05)',
        border: '1px solid rgba(255,165,0,0.3)',
        borderRadius: 8
      }}>
        {/* Size Control */}
        <div>
          <label style={{ 
            display: 'block', 
            fontSize: 11, 
            color: selectedTool === 'erase' ? '#ff6666' : '#ffaa00', 
            marginBottom: 4 
          }}>
            {selectedTool === 'erase' ? 'Eraser' : 'Brush'} Size: {brushSize}px
          </label>
          <input
            type="range"
            min="1"
            max="20"
            value={brushSize}
            onChange={(e) => setBrushSize(parseInt(e.target.value))}
            style={{
              width: '100%',
              accentColor: selectedTool === 'erase' ? '#ff6666' : '#ffaa00'
            }}
          />
        </div>

        {/* Color Control - Always visible */}
        <div>
          <label style={{ 
            display: 'block', 
            fontSize: 11, 
            color: selectedTool === 'draw' ? '#ffaa00' : '#888', 
            marginBottom: 4 
          }}>
            Color
          </label>
          <input
            type="color"
            value={brushColor}
            onChange={(e) => setBrushColor(e.target.value)}
            style={{
              width: 40,
              height: 30,
              border: 'none',
              borderRadius: 4,
              cursor: 'pointer',
              opacity: selectedTool === 'draw' ? 1 : 0.5
            }}
          />
        </div>
      </div>

      {/* Canvas Area */}
      <div style={{
        position: 'relative',
        width: 'fit-content',
        margin: '0 auto 16px auto',
        border: `2px solid ${
          selectedTool === 'draw' ? '#ffaa00' : 
          selectedTool === 'erase' ? '#ff6666' : 
          '#00ffff'
        }`,
        borderRadius: 4,
        background: 'transparent'
      }}>
        <canvas
          ref={drawingCanvasRef}
          width={width}
          height={height}
          style={{
            display: 'block',
            cursor: 
              selectedTool === 'draw' ? 'none' : 
              selectedTool === 'erase' ? 'none' :
              'default',
            borderRadius: 4,
            maxWidth: '100%',
            height: 'auto',
            width: '100%'
          }}
          onMouseDown={handleCanvasMouseDown}
          onMouseMove={(e) => {
            handleCanvasMouseMove(e);
            handleCanvasMouseHover(e);
          }}
          onMouseUp={handleCanvasMouseUp}
          onMouseEnter={handleCanvasMouseEnter}
          onMouseLeave={handleCanvasMouseLeave}
        />

        {/* Brush Preview Overlay */}
        {isHovering && mousePos && (selectedTool === 'draw' || selectedTool === 'erase') && (
          <div
            style={{
              position: 'absolute',
              left: mousePos.x - brushSize / 2,
              top: mousePos.y - brushSize / 2,
              width: brushSize,
              height: brushSize,
              borderRadius: '50%',
              pointerEvents: 'none',
              zIndex: 1000,
              border: selectedTool === 'erase' 
                ? '2px dashed rgba(0,0,0,0.8)' 
                : '2px solid rgba(255,255,255,0.9)',
              backgroundColor: selectedTool === 'draw' ? brushColor : 'transparent',
              opacity: selectedTool === 'draw' ? 0.7 : 1,
              animation: selectedTool === 'erase' ? 'dash 1s linear infinite' : 'none',
              boxShadow: selectedTool === 'draw' ? '0 0 0 1px rgba(0,0,0,0.3)' : 'none'
            }}
          />
        )}

        {/* Crop Interface Overlay */}
        {selectedTool === 'crop' && imgSrc && (
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'auto',
            borderRadius: 4,
            overflow: 'hidden'
          }}>
            <ReactCrop
              crop={crop}
              onChange={(_, percentCrop) => setCrop(percentCrop)}
              onComplete={(c) => setCompletedCrop(c)}
              aspect={aspect}
              style={{
                width: '100%',
                height: '100%'
              }}
            >
              <img
                ref={imgRef}
                alt="Crop me"
                src={imgSrc}
                style={{ 
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  borderRadius: 4,
                }}
                onLoad={onImageLoad}
              />
            </ReactCrop>
          </div>
        )}
      </div>

      {/* Hidden canvas for image processing */}
      <canvas
        ref={canvasRef}
        style={{ display: 'none' }}
        width={width}
        height={height}
      />

      {/* Apply Crop Button - Show when crop tool is active and crop is ready */}
      {selectedTool === 'crop' && completedCrop && imgSrc && (
        <div style={{ marginBottom: 16 }}>
          <button
            onClick={generateCroppedImage}
            style={{
              padding: '12px 24px',
              background: 'rgba(0,255,255,0.2)',
              border: '2px solid rgba(0,255,255,0.4)',
              borderRadius: 6,
              color: '#00ffff',
              fontSize: 14,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              fontWeight: 600,
              width: '100%'
            }}
          >
            ✅ Apply Crop to Canvas
          </button>
        </div>
      )}

      {/* Action Buttons */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: showUndoButton ? '1fr 1fr' : '1fr',
        gap: 8
      }}>
        {/* New Canvas */}
        <button
          onClick={createBlankCanvas}
          style={{
            padding: '10px 16px',
            background: 'rgba(255,165,0,0.2)',
            border: '1px solid rgba(255,165,0,0.4)',
            borderRadius: 6,
            color: '#ffaa00',
            fontSize: 12,
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            fontWeight: 600
          }}
        >
          📄 New Canvas
        </button>

        {/* Undo Button for existing cards */}
        {showUndoButton && onUndo && (
          <button
            onClick={onUndo}
            style={{
              padding: '10px 16px',
              background: 'rgba(255,255,0,0.2)',
              border: '1px solid rgba(255,255,0,0.4)',
              borderRadius: 6,
              color: '#ffff00',
              fontSize: 12,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              fontWeight: 600
            }}
          >
            ↶ Undo Changes
          </button>
        )}
      </div>
      </div>
    </>
  );
};

export default ImageEditor;
