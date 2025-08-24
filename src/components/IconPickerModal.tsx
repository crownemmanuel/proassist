import React from "react";
import {
  FaRegFileAlt,
  FaRegFileWord,
  FaRegFilePdf,
  FaRegFileImage,
  FaRegFileVideo,
  FaRegFileAudio,
  FaRegFileArchive,
  FaRegFileCode,
  FaBook,
  FaBible,
  FaPray,
  FaCross,
  FaChurch,
  FaMusic,
  FaMicrophone,
  FaUsers,
  FaUser,
  FaQuoteRight,
  FaAlignLeft,
  FaAlignRight,
  FaAlignCenter,
  FaList,
  FaListOl,
  FaListUl,
  FaQuestion,
  FaExclamation,
  FaInfo,
  FaStar,
  FaHeart,
  FaBrain,
  FaComments,
  FaComment,
  FaChalkboardTeacher,
  FaGraduationCap,
} from "react-icons/fa";

interface IconPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectIcon: (iconName: string) => void;
}

const icons = {
  "file-alt": FaRegFileAlt,
  "file-word": FaRegFileWord,
  "file-pdf": FaRegFilePdf,
  "file-image": FaRegFileImage,
  "file-video": FaRegFileVideo,
  "file-audio": FaRegFileAudio,
  "file-archive": FaRegFileArchive,
  "file-code": FaRegFileCode,
  book: FaBook,
  bible: FaBible,
  pray: FaPray,
  cross: FaCross,
  church: FaChurch,
  music: FaMusic,
  microphone: FaMicrophone,
  users: FaUsers,
  user: FaUser,
  "quote-right": FaQuoteRight,
  "align-left": FaAlignLeft,
  "align-right": FaAlignRight,
  "align-center": FaAlignCenter,
  list: FaList,
  "list-ol": FaListOl,
  "list-ul": FaListUl,
  question: FaQuestion,
  exclamation: FaExclamation,
  info: FaInfo,
  star: FaStar,
  heart: FaHeart,
  brain: FaBrain,
  comments: FaComments,
  comment: FaComment,
  "chalkboard-teacher": FaChalkboardTeacher,
  "graduation-cap": FaGraduationCap,
};

const IconPickerModal: React.FC<IconPickerModalProps> = ({
  isOpen,
  onClose,
  onSelectIcon,
}) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onMouseDown={onClose}>
      <div className="modal-content" onMouseDown={(e) => e.stopPropagation()}>
        <h2 style={{ marginTop: 0 }}>Select an Icon</h2>
        <div className="icon-grid">
          {Object.entries(icons).map(([name, IconComponent]) => (
            <div
              key={name}
              className="icon-grid-item"
              onClick={() => {
                onSelectIcon(name);
                onClose();
              }}
            >
              <IconComponent />
            </div>
          ))}
        </div>
        <div className="modal-actions">
          <button onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
};

export default IconPickerModal;

