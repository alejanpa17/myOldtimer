import { useEffect, useState } from "react";
import { fileToDataUrl } from "../lib/helpers";
import SaveCancelModal from "./SaveCancelModal";

function VehicleImageModal({ open, currentImage, onClose, onSave, onRemove }) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [preview, setPreview] = useState(null);

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
      <input
        className="input"
        type="file"
        accept="image/*"
        capture="environment"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (!file) {
            setSelectedFile(null);
            setPreview(null);
            return;
          }
          setSelectedFile(file);
          setPreview(URL.createObjectURL(file));
        }}
      />
      {displayedImage && (
        <img
          src={displayedImage}
          alt="Vehicle preview"
          className="vehicle-image"
          style={{ minHeight: 120 }}
        />
      )}
      <button
        type="button"
        className="btn-danger"
        disabled={!currentImage}
        onClick={async () => {
          await onRemove();
          handleClose();
        }}
      >
        Remove Picture
      </button>
    </SaveCancelModal>
  );
}

export default VehicleImageModal;
