import { useEffect, useRef, useState } from "react";
import { fileToDataUrl } from "../lib/helpers";
import SaveCancelModal from "./SaveCancelModal";

function VehicleImageModal({ open, currentImage, onClose, onSave, onRemove }) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const cameraInputRef = useRef(null);
  const galleryInputRef = useRef(null);

  useEffect(() => {
    return () => {
      if (preview) {
        URL.revokeObjectURL(preview);
      }
    };
  }, [preview]);

  if (!open) {
    return null;
  }

  const handleSelectedFile = (file) => {
    if (!file) {
      setSelectedFile(null);
      setPreview(null);
      return;
    }
    setSelectedFile(file);
    setPreview(URL.createObjectURL(file));
  };

  const handleClose = () => {
    setSelectedFile(null);
    setPreview(null);
    onClose();
  };

  const handleSave = async () => {
    if (!selectedFile) {
      handleClose();
      return;
    }
    const imageDataUrl = await fileToDataUrl(selectedFile);
    await onSave(imageDataUrl);
    handleClose();
  };

  const displayedImage = preview || currentImage;

  return (
    <SaveCancelModal
      open={open}
      title="Vehicle Photo"
      onSave={handleSave}
      onCancel={handleClose}
    >
      <div className="btn-row">
        <button
          type="button"
          onClick={() => {
            cameraInputRef.current?.click();
          }}
        >
          Camera
        </button>
        <button
          type="button"
          onClick={() => {
            galleryInputRef.current?.click();
          }}
        >
          Gallery
        </button>
      </div>
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: "none" }}
        onChange={(event) => handleSelectedFile(event.target.files?.[0] || null)}
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={(event) => handleSelectedFile(event.target.files?.[0] || null)}
      />
      {displayedImage && (
        <img
          src={displayedImage}
          alt="Vehicle preview"
          className="vehicle-image"
          style={{ minHeight: 120 }}
        />
      )}
      {currentImage && (
        <button
          type="button"
          className="btn-danger"
          onClick={async () => {
            await onRemove();
            handleClose();
          }}
        >
          Remove Picture
        </button>
      )}
    </SaveCancelModal>
  );
}

export default VehicleImageModal;
