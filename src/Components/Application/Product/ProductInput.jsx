import React, { useEffect, useRef, useState } from "react"
import MDEditor from "@uiw/react-md-editor"
import { styled } from "@mui/material/styles"
import {
  Autocomplete,
  Checkbox,
  FormControl,
  FormControlLabel,
  FormGroup,
  IconButton,
  TextField,
  Stack,
  Chip,
  Modal,
  FormHelperText
} from "@mui/material"
import { DeleteOutlined } from "@mui/icons-material"
import cogoToast from "cogo-toast"
import { DatePicker } from "@mui/x-date-pickers/DatePicker"
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs"
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider"
import moment from "moment"
import dayjs from "dayjs"
import PlacePickerMap from "../../../Components/PlacePickerMap/PlacePickerMap"
import { TimePicker } from "@mui/x-date-pickers/TimePicker"
import { getCall, postCall } from "../../../Api/axios"

import DaysPicker from "react-multi-date-picker"
import DatePanel from "react-multi-date-picker/plugins/date_panel"

import MicIcon from "../../../Assets/Images/micIcon.svg"
import CloseIcon from "../../../Assets/Images/closeIcon.svg"
import WhiteMicIcon from "../../../Assets/Images/whiteMicIcon.svg"
import voiceIcon from "../../../Assets/Images/voiceIcon.svg"
import googleMicIcon from "../../../Assets/Images/googleMic.svg"
import TextBodyModal from "./TextBodyModal"
import UploadBodyModal from "./UploadBodyModal"
import useCancellablePromise from "../../../Api/cancelRequest"
import useDebounce from "../../../hooks/useDebounce"
import axios from "axios"
import { extractKeyValuePairs } from "../../../utils/formatting/string"
import Cookies from "js-cookie"

const CssTextField = styled(TextField)({
  "& .MuiOutlinedInput-root": {
    "& fieldset": {
      borderColor: "black"
    },
    "&:hover fieldset": {
      borderColor: "#1c75bc"
    },
    "&.Mui-focused fieldset": {
      borderColor: "#1c75bc"
    }
  }
})

const defaultLanguage = {
  key: "Hindi",
  value: "hi"
}

const ProductInput = ({
  item,
  state,
  stateHandler,
  onChange,
  previewOnly,
  setFocusedField
}) => {
  const uploadFileRef = useRef(null)
  const [isImageChanged, setIsImageChanged] = useState(false)
  const [isImageEdit, setIsImageEdit] = useState(false)
  const [editImageInputValue, setEditImageInputValue] = useState("")
  const [languageList, setLanguageList] = useState([])
  const [selectLanguage, setSelectLanguage] = useState(defaultLanguage)
  const [aiInput, setAiInput] = useState({
    id: "",
    value: ""
  })
  const [aiInputResponse, setAiInputResponse] = useState("")
  const [aiLoading, setAiLoading] = useState(false)
  const [fileLoading, setFileLoading] = useState([])
  const [listening, setListening] = useState(false)
  const [open, setOpen] = useState(false)
  const [fetchedImageSize, setFetchedImageSize] = useState(0)
  const { cancellablePromise } = useCancellablePromise()
  const [showPreview, setShowPreview] = useState(false)
  const [markdownValue, setMarkdownValue] = useState("")

  const [selectedFiles, setSelectedFiles] = useState([])

  const handleFileChange = async (e, item) => {
    const files = Array.from(e.target.files)
    setFileLoading(files)
    const formData = new FormData()
    for (const file of files) {
      formData.append("images", file)
    }
    try {
      const url = `/api/v1/gcp-upload`
      const res = await postCall(url, formData)
      setSelectedFiles((prevSelectedFiles) => {
        return [...prevSelectedFiles, ...res.urls] // Append the new URLs to the existing array
      })

      stateHandler((prevState) => {
        const newState = {
          ...prevState,
          [item.id]: [...(prevState[item.id] || []), ...res.urls]
        }
        return newState
      })
      setFileLoading([])
    } catch (error) {
      setFileLoading([])
      cogoToast.error("Please try again")
    }
  }

  useEffect(() => {
    getLanguageList()
  }, [])

  useEffect(() => {
    if (state["images"]?.length > 0) {
      setSelectedFiles(state["images"])
    }
  }, [state])

  const handleFocus = (fieldId) => {
    if (setFocusedField) {
      setFocusedField(fieldId)
    }
  }

  const handleBlur = () => {
    if (setFocusedField) {
      setFocusedField(null)
    }
  }

  const getSizeWithUnit = (size) => {
    if (size >= 1024 * 1024) {
      return (size / (1024 * 1024)).toFixed(2) + " MB"
    } else if (size >= 1024) {
      return (size / 1024).toFixed(2) + " KB"
    } else {
      return size + " bytes"
    }
  }

  const getImageSizeFromUrl = async () => {
    try {
      const response = await fetch(state[item.id])
      const blob = await response.blob()
      const sizeInBytes = blob.size
      const sizeInKilobytes = sizeInBytes / 1024
      setFetchedImageSize(sizeInKilobytes.toFixed(2) + " KB")
    } catch (error) {
      setFetchedImageSize("2 MB")
    }
  }

  const getLanguageList = async () => {
    const url = process.env.REACT_APP_LANGUAGE_LIST
    try {
      const response = await cancellablePromise(getCall(url))
      if (response?.results.length > 0) {
        const result = response.results.map((lang) => {
          return {
            key: lang.displayName,
            value: lang.languageCode
          }
        })
        const uniqueArray = result.filter(
          (value, index, self) =>
            self.findIndex((item) => item.key === value.key) === index
        )
        setLanguageList(uniqueArray)
      } else {
        cogoToast.error("Network error")
      }
    } catch (error) {
      cogoToast.error("Network error")
    }
  }

  useEffect(() => {
    if (item.type !== "upload") return
    if (isImageChanged === false && state[item.id] !== "") {
      getImageSizeFromUrl()
    } else {
      const sizeInBytes = getSizeWithUnit(uploadFileRef.current?.files[0]?.size)
      setFetchedImageSize(sizeInBytes)
    }
  }, [isImageChanged, state[item.id]])

  const handleStartListening = (item) => {
    if (aiLoading) return
    if (!isImageEdit) {
      setAiInputResponse("")
    }
    setAiInput({
      id: "",
      value: ""
    })
    if ("SpeechRecognition" in window || "webkitSpeechRecognition" in window) {
      const SpeechRecognition =
        window.SpeechRecognition || window.webkitSpeechRecognition
      const recognition = new SpeechRecognition()

      recognition.lang = selectLanguage.value

      recognition.onstart = () => {
        setListening(true)
      }

      recognition.onresult = (event) => {
        const last = event.results.length - 1
        const text = event.results[last][0].transcript
        if (!isImageEdit) {
          setAiInput((prevTranscript) => {
            return {
              id: item.id,
              value: `${prevTranscript.value} ${text}`
            }
          })
        } else {
          setEditImageInputValue((prevTranscript) => {
            return `${prevTranscript} ${text}`
          })
        }
      }

      recognition.onend = () => {
        setListening(false)
      }

      // Start listening
      recognition.start()
    } else {
      alert("Speech recognition is not supported in your browser.")
    }
  }

  const closeModal = () => {
    setOpen(false)
    setSelectLanguage(defaultLanguage)
    setAiInput({
      id: "",
      value: ""
    })
    setAiInputResponse("")
    setAiLoading(false)
    setIsImageEdit(false)
    setEditImageInputValue("")
    setMarkdownValue("")
  }

  const getInputTitle = async (item, language) => {
    if (aiInputResponse.length === 0) return
    stateHandler({
      ...state,
      [item.id]: item.isUperCase
        ? aiInputResponse.toUpperCase()
        : aiInputResponse
    })
    setOpen(false)
    setAiLoading(false)
    setAiInput({
      id: "",
      value: ""
    })
    setAiInputResponse("")
    setMarkdownValue("")
    setEditImageInputValue("")
  }

  const openModal = () => {
    setOpen(!open)
    setSelectLanguage(defaultLanguage)
  }

  useDebounce(() => getResponseFromAi(), 1000, [aiInput])
  useDebounce(() => editImageAPI(), 1000, [editImageInputValue])

  const onChangeHandler = (value, item) => {
    stateHandler({
      ...state,
      [item.id]: item.isUperCase ? value.toUpperCase() : value
    })
  }

  const getResponseFromAi = async () => {
    // For Title
    if (aiInput.id === "productName" && aiInput.value.length > 0) {
      const url = process.env.REACT_APP_LANGUAGE_DETECT
      const body = [aiInput.value]
      try {
        const langDetectResponse = await cancellablePromise(postCall(url, body))
        const lang = langDetectResponse?.results[0]?.detections[0]?.languageCode
        setAiLoading(true)
        await getProductTitleAPI(aiInput.value, lang)
      } catch (e) {
        setAiLoading(false)
        cogoToast.error("Please try again")
      }
    }
    if (aiInput.id === "packQty" && aiInput.value.length > 0) {
      const url = process.env.REACT_APP_PRODUCT_ATTRIBS;
      const body = [aiInput.value];
      try {
        const langDetectResponse = await cancellablePromise(
          postCall(url, body)
        );
        const lang =
          langDetectResponse?.results[0]?.detections[0]?.languageCode;
        setAiLoading(true);
        await getProductInputAPI(aiInput.id, aiInput.value);
      } catch (e) {
        setAiLoading(false);
        cogoToast.error("Please try again");
      }
    }

    if (aiInput.id === "length" && aiInput.value.length > 0) {
      const url = process.env.REACT_APP_PRODUCT_ATTRIBS;
      const body = [aiInput.value];
      try {
        const langDetectResponse = await cancellablePromise(
          postCall(url, body)
        );
        const lang =
          langDetectResponse?.results[0]?.detections[0]?.languageCode;
        setAiLoading(true);
        await getProductInputAPI(aiInput.id, aiInput.value);
      } catch (e) {
        setAiLoading(false);
        cogoToast.error("Please try again");
      }
    }

    if (aiInput.id === "breadth" && aiInput.value.length > 0) {
      const url = process.env.REACT_APP_PRODUCT_ATTRIBS;
      const body = [aiInput.value];
      try {
        const langDetectResponse = await cancellablePromise(
          postCall(url, body)
        );
        const lang =
          langDetectResponse?.results[0]?.detections[0]?.languageCode;
        setAiLoading(true);
        await getProductInputAPI(aiInput.id, aiInput.value);
      } catch (e) {
        setAiLoading(false);
        cogoToast.error("Please try again");
      }
    }

    if (aiInput.id === "height" && aiInput.value.length > 0) {
      const url = process.env.REACT_APP_PRODUCT_ATTRIBS;
      const body = [aiInput.value];
      try {
        const langDetectResponse = await cancellablePromise(
          postCall(url, body)
        );
        const lang =
          langDetectResponse?.results[0]?.detections[0]?.languageCode;
        setAiLoading(true);
        await getProductInputAPI(aiInput.id, aiInput.value);
      } catch (e) {
        setAiLoading(false);
        cogoToast.error("Please try again");
      }
    }

    if (aiInput.id === "weight" && aiInput.value.length > 0) {
      const url = process.env.REACT_APP_PRODUCT_ATTRIBS;
      const body = [aiInput.value];
      try {
        const langDetectResponse = await cancellablePromise(
          postCall(url, body)
        );
        const lang =
          langDetectResponse?.results[0]?.detections[0]?.languageCode;
        setAiLoading(true);
        await getProductInputAPI(aiInput.id, aiInput.value);
      } catch (e) {
        setAiLoading(false);
        cogoToast.error("Please try again");
      }
    }

    //For Description
    if (
      (aiInput.id === "longDescription" || aiInput.id === "description") &&
      aiInput.value.length > 0
    ) {
      const url = process.env.REACT_APP_LANGUAGE_DETECT
      const body = [aiInput.value]
      try {
        const langDetectResponse = await cancellablePromise(postCall(url, body))
        const lang = langDetectResponse?.results[0]?.detections[0]?.languageCode
        setAiLoading(true)
        await getDescriptionAPI(aiInput.value, lang, aiInput.id)
      } catch (e) {
        setAiLoading(false)
        cogoToast.error("Please try again")
      }
    }

    //For Image upload
    if (aiInput.id === "images" && aiInput.value.length > 0) {
      const url = process.env.REACT_APP_LANGUAGE_DETECT
      const body = [aiInput.value]
      try {
        const langDetectResponse = await cancellablePromise(postCall(url, body))
        const lang = langDetectResponse?.results[0]?.detections[0]?.languageCode
        setAiLoading(true)
        await getImageAPI(aiInput.value, lang)
      } catch (e) {
        setAiLoading(false)
        cogoToast.error("Please try again")
      }
    }

    //For Product Attribute
    if (aiInput.id === "attributes" && aiInput.value.length > 0) {
      setAiLoading(true)
      await getProductInputAPI(aiInput.id, aiInput.value)
    }
  }

  const getProductTitleAPI = async (value, language) => {
    const url = process.env.REACT_APP_PRODUCT_TITLE
    const body = {
      text: value,
      language: language,
      prompt:
        "Context: Create a nice Title for the following product including all keywords and help improve listing quality index",
      desc: "Example: [Brand Name] - [Colour] coloured [Title] [All Keywords] with [USP]."
    }
    try {
      const response = await cancellablePromise(postCall(url, body))
      if (response?.results?.translatedContent) {
        setAiInputResponse(response.results.translatedContent)
        setAiLoading(false)
      } else {
        cogoToast.error("Please try again")
        setAiLoading(false)
      }
    } catch (error) {
      setAiLoading(false)
      cogoToast.error("Please try again")
    }
  }

  const getDescriptionAPI = async (value, language, desc) => {
    const url = process.env.REACT_APP_PRODUCT_DESCRIPTION
    const body = {
      text: value,
      language: language,
      prompt: `Context: Create a nice,${
        desc !== "longDescription" ? " short 2-3 points" : ""
      } detailed bulleted Description of the following product including all keywords and help improve listing quality index.`
    }
    try {
      const response = await cancellablePromise(postCall(url, body))
      if (response?.results?.translatedContent) {
        setAiInputResponse(response.results.translatedContent)
        setMarkdownValue(response.results.translatedContent)
        setAiLoading(false)
      } else {
        cogoToast.error("Please try again")
        setAiLoading(false)
      }
    } catch (error) {
      setAiLoading(false)
      cogoToast.error("Please try again")
    }
  }

  const getImageAPI = async (value, language) => {
    const body = JSON.stringify({
      text: value,
      language,
      prompt: "Context: Generate images of the following Products",
      gcsbucket: "gen-ai-399709-stg"
    })
    const config = {
      method: "post",
      url: process.env.REACT_APP_PRODUCT_IMAGE_GENERATE,
      headers: {
        samplecount: "1",
        "Content-Type": "application/json"
      },
      data: body
    }

    try {
      const response = await axios(config)
      if (response?.data.results[0]?.signedUri) {
        setAiInputResponse({
          imageName: response?.data.results[0]?.fileName,
          url: response?.data.results[0]?.signedUri
        })
        setAiLoading(false)
      } else {
        cogoToast.error("Please try again")
        setAiLoading(false)
      }
    } catch (error) {
      setAiLoading(false)
      cogoToast.error("Please try again")
    }
  }

  const getProductInputAPI = async (id, value) => {
    try {
      setAiInputResponse(value);
      setAiLoading(false);
    } catch (error) {
      setAiLoading(false);
      cogoToast.error("Please try again");
    }
  };

  const removeImage = () => {
    setAiInputResponse("")
    setAiInput({
      ...aiInput,
      value: ""
    })
  }

  const editImage = () => {
    setIsImageEdit(true)
  }

  const editImageAPI = async () => {
    if (editImageInputValue.length === 0) return
    const url = process.env.REACT_APP_LANGUAGE_DETECT
    const body = [editImageInputValue]
    try {
      const langDetectResponse = await cancellablePromise(postCall(url, body))
      const lang = langDetectResponse?.results[0]?.detections[0]?.languageCode
      await getEditedImageAI(editImageInputValue, lang)
    } catch (e) {
      setAiLoading(false)
      cogoToast.error("Please try again")
    }
  }

  const getEditedImageAI = async (value, lang) => {
    if (value.length > 0) {
      setAiLoading(true)
      const body = JSON.stringify({
        text: value,
        language: lang,
        prompt: "Context: Edit the image as the following:",
        gcsbucket: "gen-ai-399709-stg",
        filename: aiInputResponse.imageName
      })
      const config = {
        method: "post",
        url: process.env.REACT_APP_PRODUCT_IMAGE_EDIT,
        headers: {
          samplecount: "1",
          "Content-Type": "application/json"
        },
        data: body
      }
      try {
        const response = await axios(config)
        if (response?.data.results[0]?.signedUri) {
          setAiInputResponse({
            imageName: response?.data.results[0]?.fileName,
            url: response?.data.results[0]?.signedUri
          })
          setAiLoading(false)
        } else {
          cogoToast.error("Please try again")
          setAiLoading(false)
        }
      } catch (error) {
        setAiLoading(false)
        cogoToast.error("Please try again")
      }
    }
  }

  const removePreviewImage = (e, images, item) => {
    const imagesData = selectedFiles.filter((file) => file.name !== images.name)
    setSelectedFiles(imagesData)
    stateHandler((prevState) => {
      const newState = {
        ...prevState,
        [item.id]: imagesData
      }
      return newState
    })
  }

  const fileUpload = (data, item) => {
    if (aiLoading) return
    setSelectedFiles((prevSelectedFiles) => {
      return [...prevSelectedFiles, { url: data.url, name: data.imageName }] // Append the new URLs to the existing array
    })

    stateHandler((prevState) => {
      const newState = {
        ...prevState,
        [item.id]: [
          ...(prevState[item.id] || []),
          { url: data.url, name: data.imageName }
        ]
      }
      return newState
    })

    setOpen(false)
    setAiLoading(false)
    setAiInput({
      id: "",
      value: ""
    })
    setAiInputResponse("")
    setIsImageEdit(false)
    setEditImageInputValue(false)
  }

  if (item.type === "input") {
    return (
      <div className={`${item.class} relative`}>
        <label className="text-sm text-label py-2 ml-1 font-medium text-left text-[#606161] inline-block">
          {item.title}
          {item.required && <span className="text-[#FF0000]"> *</span>}
        </label>
        <CssTextField
          type={item.password ? "password" : "input"}
          className="w-full h-full text-input px-2.5 py-3.5 text-[#606161] bg-transparent !border-black"
          required={item.required}
          size="small"
          multiline={item.multiline || false}
          maxRows={item.multiline ? 5 : 1}
          autoComplete="off"
          placeholder={item.placeholder}
          error={item.error || false}
          disabled={item?.isDisabled || previewOnly || false}
          helperText={item.error && item.helperText}
          value={state[item.id]}
          onChange={(e) => onChangeHandler(e.target.value, item)}
          inputProps={{
            maxLength: item.maxLength || undefined,
            minLength: item.minLength || undefined
          }}
          onFocus={() => handleFocus(item.id)}
          onBlur={handleBlur}
        />
        {item.hasMicIcon && (
          <>
            <span className="mic-icon" onClick={openModal}>
              <img src={googleMicIcon} alt="" />
            </span>
            <Modal
              open={open}
              keepMounted
              //   onClose={() => setOpen(false)}
              aria-labelledby="modal-modal-title"
              aria-describedby="modal-modal-description"
            >
              <div className="speech-modal">
                <div className="modal-header">
                  <span
                    className="close-btn cursor-pointer"
                    onClick={closeModal}
                  >
                    <img src={CloseIcon} alt="close-icon" />
                  </span>
                </div>
                <div className="modal-body">
                  <TextBodyModal
                    listening={listening}
                    aiInput={aiInput}
                    item={item}
                    aiInputResponse={aiInputResponse}
                    setAiInput={setAiInput}
                    aiLoading={aiLoading}
                  />
                </div>
                <div className="modal-footer">
                  <div className="btn-group">
                    <div className="lang-select">
                      <Autocomplete
                        size="small"
                        options={languageList}
                        getOptionLabel={(option) => option.key}
                        value={selectLanguage}
                        isOptionEqualToValue={(option, value) =>
                          option.key === value.key
                        }
                        disableClearable={true}
                        onChange={(event, newValue) => {
                          setSelectLanguage(newValue)
                        }}
                        className="text-input"
                        renderInput={(params) => (
                          <TextField
                            {...params}
                            placeholder={"Select your language"}
                            variant="outlined"
                            error={item.error || false}
                            helperText={item.error && item.helperText}
                          />
                        )}
                      />
                    </div>
                    {!listening ? (
                      <button
                        className={`mic-button${
                          aiLoading ? " opacity-50 cursor-not-allowed" : ""
                        }`}
                        onClick={() => handleStartListening(item)}
                      >
                        <img src={WhiteMicIcon} alt="mic-icon" />
                      </button>
                    ) : (
                      <span className="mic-button">
                        <img src={voiceIcon} alt="voice-icon" />
                      </span>
                    )}
                    <button
                      className={`sbt-button${
                        aiInputResponse.length === 0
                          ? " opacity-50 cursor-not-allowed"
                          : ""
                      }`}
                      onClick={() => getInputTitle(item)}
                    >
                      {!aiLoading ? "Submit" : "Loading..."}
                    </button>
                  </div>
                </div>
              </div>
            </Modal>
          </>
        )}
      </div>
    )
  } else if (item.type === "input-desc") {
    return (
      <div className={`${item.class} relative`}>
        <div className="desc-input">
          <label className="text-sm text-label py-2 ml-1 font-medium text-left text-[#606161] inline-block">
            {item.title}
            {item.required && <span className="text-[#FF0000]"> *</span>}
          </label>
          {state[item.id].length > 0 && (
            <div className="toggle-menu">
              <label className={`switch round`}>
                <input
                  type="checkbox"
                  checked={showPreview}
                  onChange={() => setShowPreview(!showPreview)}
                />
                <span className={`slider round`} />
              </label>
              <span className="text">Markdown Preview</span>
            </div>
          )}
        </div>
        {!showPreview ? (
          <>
            <div className="position-relative desc-mic-input">
              <CssTextField
                type={item.password ? "password" : "input"}
                className="w-full h-full text-input px-2.5 py-3.5 text-[#606161] bg-transparent !border-black"
                required={item.required}
                size="small"
                multiline={item.multiline || false}
                maxRows={item.multiline ? 5 : 1}
                autoComplete="off"
                placeholder={item.placeholder}
                error={item.error || false}
                disabled={item?.isDisabled || previewOnly || false}
                helperText={item.error && item.helperText}
                value={state[item.id]}
                onChange={(e) => onChangeHandler(e.target.value, item)}
                inputProps={{
                  maxLength: item.maxLength || undefined,
                  minLength: item.minLength || undefined
                }}
                onFocus={() => handleFocus(item.id)}
                onBlur={handleBlur}
              />
              <span className="mic-icon" onClick={openModal}>
                <img src={googleMicIcon} alt="" />
              </span>
            </div>
            {item.hasMicIcon && (
              <>
                <Modal
                  open={open}
                  keepMounted
                  //   onClose={() => setOpen(false)}
                  aria-labelledby="modal-modal-title"
                  aria-describedby="modal-modal-description"
                >
                  <div className="speech-modal">
                    <div className={`modal-header`}>
                      <span
                        className="close-btn cursor-pointer"
                        onClick={closeModal}
                      >
                        <img src={CloseIcon} alt="close-icon" />
                      </span>
                    </div>
                    <div className="modal-body">
                      <TextBodyModal
                        listening={listening}
                        aiInput={aiInput}
                        item={item}
                        aiInputResponse={aiInputResponse}
                        setAiInput={setAiInput}
                        aiLoading={aiLoading}
                        markdownValue={markdownValue}
                        setMarkdownValue={setMarkdownValue}
                        setAiInputResponse={setAiInputResponse}
                      />
                    </div>
                    <div className="modal-footer">
                      <div className="btn-group">
                        <div className="lang-select">
                          <Autocomplete
                            size="small"
                            options={languageList}
                            getOptionLabel={(option) => option.key}
                            value={selectLanguage}
                            isOptionEqualToValue={(option, value) =>
                              option.key === value.key
                            }
                            disableClearable={true}
                            onChange={(event, newValue) => {
                              setSelectLanguage(newValue)
                            }}
                            className="text-input"
                            renderInput={(params) => (
                              <TextField
                                {...params}
                                placeholder={"Select your language"}
                                variant="outlined"
                                error={item.error || false}
                                helperText={item.error && item.helperText}
                              />
                            )}
                          />
                        </div>
                        {!listening ? (
                          <button
                            className={`mic-button${
                              aiLoading ? " opacity-50 cursor-not-allowed" : ""
                            }`}
                            onClick={() => handleStartListening(item)}
                          >
                            <img src={WhiteMicIcon} alt="mic-icon" />
                          </button>
                        ) : (
                          <span className="mic-button">
                            <img src={voiceIcon} alt="voice-icon" />
                          </span>
                        )}
                        <button
                          className={`sbt-button${
                            aiInputResponse.length === 0
                              ? " opacity-50 cursor-not-allowed"
                              : ""
                          }`}
                          onClick={() => getInputTitle(item)}
                        >
                          {!aiLoading ? "Submit" : "Loading..."}
                        </button>
                      </div>
                    </div>
                  </div>
                </Modal>
              </>
            )}
          </>
        ) : (
          <>
            <div data-color-mode="light" className="desc-markdown p-1">
              <MDEditor
                hideToolbar={true}
                value={state[item.id]}
                preview="preview"
                height="115px"
              />
            </div>
          </>
        )}
      </div>
    )
  } else if (item.type === "number") {
    return (
      <div className={`${item.class}`}>
        <label className="text-sm py-2 ml-1 font-medium text-left text-[#606161] inline-block">
          {item.title}
          {item.required && <span className="text-[#FF0000]"> *</span>}
        </label>
        <CssTextField
          type="number"
          className="w-full h-full px-2.5 py-3.5 text-input text-[#606161] bg-transparent !border-black"
          required={item.required}
          size="small"
          InputProps={{
            inputProps: { min: item.min || 0, max: item.max || 100000 }
          }}
          placeholder={item.placeholder}
          error={item.error || false}
          disabled={item?.isDisabled || previewOnly || false}
          helperText={item.error && item.helperText}
          value={state[item.id]}
          onChange={(e) => {
            const value = item.valueInDecimal
              ? parseFloat(e.target.value).toFixed(2)
              : e.target.value

            // Enforce maximum length
            const maxLength = item.maxLength || undefined
            if (maxLength && value.length > maxLength) {
              return
            }

            stateHandler({
              ...state,
              [item.id]: value
            })
          }}
          inputProps={{
            step: "1"
          }}
          onFocus={() => handleFocus(item.id)}
          onBlur={handleBlur}
        />
      </div>
    )
  } else if (item.type === "radio") {
    // console.log("state[item.id]=====>", state[item.id]);
    // console.log("item.options=====>", item.options);
    let isDisabled = false
    if (
      item.id === "isVegetarian" &&
      state["productCategory"] &&
      state["productCategory"] !== "f_and_b"
    ) {
      isDisabled = true
    } else {
    }
    return (
      <div className={`${item.class}`}>
        <label className="text-sm py-2 ml-1 font-medium text-left text-[#606161] inline-block">
          {item.title}
          {item.required && <span className="text-[#FF0000]"> *</span>}
        </label>
        <div className="field-rep-block">
          {item.options.map((radioItem, i) => {
            return (
              <div
                className={`field-radio-block${
                  radioItem.value === state[item.id] ? " radio-checked" : ""
                }`}
                key={i}
              >
                <label className="radio radio-outline-primary field-radio mb-0">
                  <input
                    type="radio"
                    name={item.id}
                    disabled={
                      item?.isDisabled || isDisabled || previewOnly || false
                    }
                    onChange={(e) => {
                      console.log("e.target.value=====>", e.target.value)
                      console.log("item.i=====>", item.id)
                      stateHandler({ ...state, [item.id]: e.target.value })
                    }}
                    value={radioItem.value}
                    checked={radioItem.value === state[item.id]}
                  />
                  <span>{radioItem.key}</span>
                  <span className="checkmark"></span>
                </label>
              </div>
            )
          })}
        </div>
        {/* <RadioGroup
          aria-label={item.id}
          name={item.id}
          value={state[item.id]}
          onChange={(e) => {
            console.log("e.target.value=====>", e.target.value)
            console.log("item.i=====>", item.id)
            // stateHandler({ ...state, [item.id]: e.target.value });
          }}
          disabled={isDisabled}
        >
          <div className="flex flex-row">
            {item.options.map((radioItem, i) => (
              <FormControlLabel
                disabled={
                  item?.isDisabled || isDisabled || previewOnly || false
                }
                key={i}
                value={radioItem.value}
                control={
                  <Radio
                    size="small"
                    checked={radioItem.value === state[item.id]}
                  />
                }
                label={
                  <div className="text-sm font-medium text-[#606161]">
                    {radioItem.key}
                  </div>
                }
              />
            ))}
          </div>
        </RadioGroup> */}
      </div>
    )
  } else if (item.type === "checkbox") {
    //  console.log("state[item.id]=====>", state[item.id]);
    //  console.log("item.options=====>", item.options);
    const onChange = (e) => {
      const val = e.target.name
      const itemIndex = state[item.id].indexOf(val)
      if (itemIndex == -1) {
        stateHandler((prevState) => {
          const newState = {
            ...prevState,
            [item.id]: [...prevState[item.id], val]
          }
          return newState
        })
      } else {
        stateHandler((prevState) => {
          const newState = {
            ...prevState,
            [item.id]: prevState[item.id].filter((ele) => ele != val)
          }
          return newState
        })
      }
    }
    return (
      <div className="py-1 flex flex-col">
        <label className="text-sm py-2 ml-1 font-medium text-left text-[#606161] inline-block">
          {item.title}
          {item.required && <span className="text-[#FF0000]"> *</span>}
        </label>
        <FormGroup row>
          {item.options.map((checkboxItem) => (
            <FormControlLabel
              control={
                <Checkbox
                  disabled={item?.isDisabled || previewOnly || false}
                  key={checkboxItem.key}
                  onChange={onChange}
                  name={checkboxItem.value}
                  size="small"
                  checked={
                    state[item.id] &&
                    state[item.id].find((day) => day === checkboxItem.value)
                      ? true
                      : false
                  }
                />
              }
              label={
                <div
                  className="text-sm font-medium text-[#606161]"
                  key={checkboxItem.key}
                >
                  {checkboxItem.key}
                </div>
              }
            />
          ))}
        </FormGroup>
      </div>
    )
  } else if (item.type === "divider") {
    return (
      <div className={`${item.class}`}>
        <div className="divider">
          <hr />
        </div>
      </div>
    )
  } else if (item.type === "attributes") {
    return (
      <div className={`${item.class}`}>
        <div className="attributes-heading">
          <div className="title">Attributes</div>
          <div className="actions relative">
            <span className="mic-icon" onClick={openModal}>
              <img src={googleMicIcon} alt="" />
            </span>
            <Modal
              open={open}
              keepMounted
              //   onClose={() => setOpen(false)}
              aria-labelledby="modal-modal-title"
              aria-describedby="modal-modal-description"
            >
              <div className="speech-modal">
                <div className="modal-header">
                  <span
                    className="close-btn cursor-pointer"
                    onClick={closeModal}
                  >
                    <img src={CloseIcon} alt="close-icon" />
                  </span>
                </div>
                <div className="modal-body">
                  <TextBodyModal
                    listening={listening}
                    aiInput={aiInput}
                    item={item}
                    aiInputResponse={aiInputResponse}
                    setAiInput={setAiInput}
                    aiLoading={aiLoading}
                  />
                </div>
                <div className="modal-footer">
                  <div className="btn-group">
                    <div className="lang-select">
                      <Autocomplete
                        size="small"
                        options={languageList}
                        getOptionLabel={(option) => option.key}
                        value={selectLanguage}
                        isOptionEqualToValue={(option, value) =>
                          option.key === value.key
                        }
                        disableClearable={true}
                        onChange={(event, newValue) => {
                          setSelectLanguage(newValue)
                        }}
                        className="text-input"
                        renderInput={(params) => (
                          <TextField
                            {...params}
                            placeholder={"Select your language"}
                            variant="outlined"
                            error={item.error || false}
                            helperText={item.error && item.helperText}
                          />
                        )}
                      />
                    </div>
                    {!listening ? (
                      <button
                        className={`mic-button${
                          aiLoading ? " opacity-50 cursor-not-allowed" : ""
                        }`}
                        onClick={() => handleStartListening(item)}
                      >
                        <img src={WhiteMicIcon} alt="mic-icon" />
                      </button>
                    ) : (
                      <span className="mic-button">
                        <img src={voiceIcon} alt="voice-icon" />
                      </span>
                    )}
                    <button
                      className={`sbt-button${
                        aiInputResponse.length === 0
                          ? " opacity-50 cursor-not-allowed"
                          : ""
                      }`}
                      onClick={() => getInputTitle(item)}
                    >
                      {!aiLoading ? "Submit" : "Loading..."}
                    </button>
                  </div>
                </div>
              </div>
            </Modal>
          </div>
        </div>
      </div>
    )
  } else if (item.type === "select") {
    //  console.log("state[item.id]=====>", item.id, "=====>", state[item.id]);

    return (
      <div className={`${item.class}`}>
        <label className="text-sm py-2 ml-1 font-medium text-left text-[#606161] block">
          {item.title}
          {item.required && <span className="text-[#FF0000]"> *</span>}
        </label>
        <FormControl error={item.error || false} className="block w-full">
          <Autocomplete
            disableClearable={
              item.disableClearable !== undefined
                ? item.disableClearable
                : false
            }
            disabled={item?.isDisabled || previewOnly || false}
            // filterSelectedOptions
            size="small"
            options={item.options}
            getOptionLabel={(option) => option.key}
            value={
              state[item.id] !== "" && item.options && item.options.length > 0
                ? item.options.find((option) => option.value === state[item.id])
                : null
            }
            onChange={(event, newValue) => {
              stateHandler((prevState) => {
                if (item.id === "productCategory") {
                  const newState = {
                    ...prevState,
                    [item.id]: newValue.value || "",
                    productSubcategory1: ""
                  }
                  return newState
                } else {
                  const newState = {
                    ...prevState,
                    [item.id]: newValue.value
                  }
                  return newState
                }
              })
            }}
            className="text-input"
            renderInput={(params) => (
              <TextField
                {...params}
                placeholder={
                  !previewOnly && !state[item.id] ? item.placeholder : ""
                }
                variant="outlined"
                error={item.error || false}
                helperText={item.error && item.helperText}
              />
            )}
          />
        </FormControl>
      </div>
    )
  } else if (item.type === "location-picker") {
    return (
      <div className="py-1 flex flex-col">
        <label className="text-sm py-2 ml-1 mb-1 font-medium text-left text-[#606161] inline-block">
          {item.title}
          {item.required && <span className="text-[#FF0000]"> *</span>}
        </label>
        <div style={{ width: "100%", height: "400px" }}>
          <PlacePickerMap
            location={
              state[item.id]
                ? { lat: state[item.id].lat, lng: state[item.id].long }
                : {}
            }
            setLocation={(location) => {
              const {
                district,
                city,
                state: stateVal,
                area: country,
                pincode: area_code,
                locality,
                lat,
                lng
              } = location
              stateHandler({
                ...state,
                [item.id]: {
                  lat: lat,
                  long: lng
                },
                address_city: city != "" ? city : district,
                state: stateVal,
                country,
                area_code,
                locality
                // city: city != "" ? city : district,
              })
            }}
          />
        </div>
      </div>
    )
  } else if (item.type === "date-picker") {
    function reverseString(str) {
      // empty string
      let newString = ""
      for (let i = str.length - 1; i >= 0; i--) {
        newString += str[i]
      }
      return newString
    }
    const dateValue = moment(
      state[item.id],
      item.format || "DD/MM/YYYY"
    ).format(item.format ? reverseString(item.format) : "YYYY/MM/DD")
    return (
      <div className={`${item.class}`}>
        <label className="text-sm py-2 ml-1 mb-1 font-medium text-left text-[#606161] inline-block">
          {item.title}
          {item.required && <span className="text-[#FF0000]"> *</span>}
        </label>
        <LocalizationProvider dateAdapter={AdapterDayjs}>
          <DatePicker
            disableFuture
            className="w-full date-input"
            format={item.format || "DD/MM/YYYY"}
            views={item.views || ["year", "month", "day"]}
            onChange={(newValue) => {
              const date = moment(new Date(newValue))
                .format(item.format || "DD/MM/YYYY")
                .toString()
              stateHandler((prevState) => {
                const newState = {
                  ...prevState,
                  [item.id]: date
                }
                return newState
              })
            }}
            value={state[item.id] ? dayjs(dateValue) : ""}
            slots={{
              TextField: (params) => (
                <TextField
                  {...params}
                  variant="outlined"
                  error={item.error || false}
                  helperText={item.error && item.helperText}
                />
              )
            }}
          />
        </LocalizationProvider>
        {item.error && (
          <p
            class="MuiFormHelperText-root Mui-error MuiFormHelperText-sizeSmall MuiFormHelperText-contained Mui-required css-k4qjio-MuiFormHelperText-root"
            id=":r29:-helper-text"
          >
            {item.helperText}
          </p>
        )}
      </div>
    )
  } else if (item.type === "time-picker") {
    function reverseString(str) {
      // empty string
      let newString = ""
      for (let i = str.length - 1; i >= 0; i--) {
        newString += str[i]
      }
      return newString
    }
    const dateValue = moment(state[item.id], item.format || "hh:mm A")
    //  console.log("item.format======>", item.format);
    //  console.log("dateValue=====>", dateValue);
    return (
      <div className="py-1 flex flex-col" style={{ position: "relative" }}>
        {item.title && (
          <label className="text-sm py-2 ml-1 mb-1 font-medium text-left text-[#606161] inline-block">
            {item.title}
            {item.required && <span className="text-[#FF0000]"> *</span>}
          </label>
        )}
        <LocalizationProvider dateAdapter={AdapterDayjs}>
          <TimePicker
            closeOnSelect={false}
            ampm={item.ampm !== undefined ? item.ampm : true}
            format={item.format || "hh:mm A"}
            onChange={(newValue) => {
              if (stateHandler) {
                const date = moment(new Date(newValue))
                  .format(item.format || "hh:mm A")
                  .toString()
                stateHandler((prevState) => {
                  const newState = {
                    ...prevState,
                    [item.id]: date
                  }
                  return newState
                })
              } else {
                const date = moment(new Date(newValue))
                  .format(item.format || "hh:mm A")
                  .toString()
                onChange(date)
              }
            }}
            value={state[item.id] ? dayjs(dateValue) : ""}
            slots={{
              TextField: (params) => (
                <TextField
                  {...params}
                  variant="outlined"
                  error={item.error || false}
                  helperText={item.error && item.helperText}
                />
              )
            }}
          />
        </LocalizationProvider>
      </div>
    )
  } else if (item.type === "days-picker") {
    function reverseString(str) {
      // empty string
      let newString = ""
      for (let i = str.length - 1; i >= 0; i--) {
        newString += str[i]
      }
      return newString
    }
    let values = state[item.id]
    // if(values && values.length > 0){
    //   values = values.map((itemDate) => moment(itemDate, item.format || 'DD/MM/YYYY').format(item.format?reverseString(item.format):'YYYY/MM/DD'));
    // }else{}
    return (
      <div className="py-1 flex flex-col">
        <label className="text-sm py-2 ml-1 mb-1 font-medium text-left text-[#606161] inline-block">
          {item.title}
          {item.required && <span className="text-[#FF0000]"> *</span>}
        </label>
        <DaysPicker
          value={values || []}
          multiple
          format={item.format || "DD/MM/YYYY"}
          plugins={[<DatePanel />]}
          onChange={(newValue) => {
            stateHandler((prevState) => {
              const newState = {
                ...prevState,
                [item.id]: newValue.map((itemDate) => {
                  const date = moment(new Date(itemDate))
                    .format(item.format || "DD/MM/YYYY")
                    .toString()
                  console.log("date=====>", date)
                  return date
                })
              }
              return newState
            })
          }}
          render={(value, openCalendar) => {
            const valuesArray = value ? value.split(",") : ""
            return (
              <Autocomplete
                multiple
                id="tags-readOnly"
                options={[]}
                readOnly
                getOptionLabel={(option) => option}
                renderTags={(value, getTagProps) =>
                  value.map((option, index) => (
                    <Chip
                      label={option}
                      {...getTagProps({ index })}
                      onClick={() => {}}
                    />
                  ))
                }
                renderInput={(params) => (
                  <TextField
                    {...params}
                    placeholder={
                      !previewOnly && !state[item.id] ? item.placeholder : ""
                    }
                    onFocus={openCalendar}
                  />
                )}
                value={valuesArray || []}
              />
            )
          }}
        />
      </div>
    )
  } else if (item.type === "multi-select") {
    return (
      <div className="py-1 flex flex-col">
        {item.title && (
          <label className="text-sm py-2 ml-1 mb-1 font-medium text-left text-[#606161] inline-block">
            {item.title}
            {item.required && <span className="text-[#FF0000]"> *</span>}
          </label>
        )}
        <FormControl>
          <Autocomplete
            disabled={item?.isDisabled || previewOnly || false}
            multiple
            // filterSelectedOptions
            size="small"
            options={item.options}
            getOptionLabel={(option) => option.key}
            value={state[item.id]}
            onChange={(event, newValue) => {
              stateHandler((prevState) => {
                const newState = {
                  ...prevState,
                  [item.id]: newValue
                }
                return newState
              })
            }}
            renderInput={(params) => (
              <TextField
                {...params}
                placeholder={
                  state[item.id].length === 0 ? item.placeholder : ""
                }
                variant="outlined"
                error={item.error || false}
                helperText={item.error && item.helperText}
              />
            )}
          />
        </FormControl>
      </div>
    )
  } else if (item.type === "upload") {
    const allowedMaxSize = 2 * 1024 * 1024 // 2 MB in Bytes
    const getSignUrl = async (file) => {
      const url = `/api/v1/upload/${item?.file_type}`
      const file_type = file.type.split("/")[1]
      const data = {
        fileName: file.name.replace(`\.${file_type}`, ""),
        fileType: file_type
      }
      const res = await postCall(url, data)
      console.log("getSignUrl", res)
      return res
    }

    const renderUploadedUrls = () => {
      if (item?.multiple) {
        if (state?.images.length > 0) {
          return state?.images?.map((image) => {
            return (
              <img
                src={image.url}
                height={50}
                width={50}
                style={{ margin: "10px" }}
              />
            )
          })
        }
      } else {
        if ((!isImageChanged && state?.tempURL?.[item.id]) || state[item.id]) {
          return (
            <img
              src={state?.tempURL?.[item.id] || state[item.id] || ""}
              height={50}
              width={50}
              style={{ margin: "10px" }}
            />
          )
        } else {
          return <></>
        }
      }
    }

    if (previewOnly) {
      if (typeof state[item.id] == "string") {
        return (
          <div
            style={{ height: 100, width: 100, marginBottom: 40, marginTop: 10 }}
          >
            <label
              className="text-sm py-2 ml-1 font-medium text-left text-[#606161] inline-block"
              style={{ width: 200 }}
            >
              {item.title}
            </label>
            <img className="ml-1 h-full w-full" src={state[item.id]} />
          </div>
        )
      } else {
        return (
          <div
            style={{ height: 100, width: 100, marginBottom: 40, marginTop: 10 }}
            className="flex"
          >
            <label className="text-sm py-2 ml-1 font-medium text-left text-[#606161] inline-block">
              {item.title}
            </label>
            {state[item.id]?.map((img_url) => (
              <img className="ml-1 h-full w-full" key={img_url} src={img_url} />
            ))}
          </div>
        )
      }
    }

    const UploadedFile = ({ name, size }) => {
      if (!name) return

      const getImageName = (path) => {
        const splitPath = path.split("/")
        const fileTypeIndex = splitPath.indexOf(item.file_type)

        if (fileTypeIndex !== -1 && fileTypeIndex + 1 < splitPath.length) {
          const nameUrl = splitPath[fileTypeIndex + 1]
          return nameUrl
        } else {
          return item.file_type
        }
      }
      const getImageType = (path) => {
        const splitPath = path.split("/")
        const fileType = splitPath[splitPath.length - 1].split(".").pop()
        return fileType
      }

      return (
        <Stack
          direction="row"
          spacing={1}
          alignItems={"center"}
          style={{ marginBottom: 20 }}
        >
          <IconButton
            style={{ width: 35, height: 35 }}
            size="small"
            color="error"
            onClick={(e) => {
              e.stopPropagation()
              // reset file input
              uploadFileRef.current.value = null
              stateHandler((prevState) => {
                const newState = {
                  ...prevState,
                  [item.id]: Array.isArray(prevState[item.id])
                    ? prevState[item.id].filter((ele) => ele != name)
                    : "",
                  uploaded_urls: []
                }
                return newState
              })
            }}
          >
            <DeleteOutlined fontSize="small" />
          </IconButton>
          <div>
            <div className="flex items-center">
              <p className="text-xs text-neutral-900 max-w-sm">
                File name: &nbsp;
              </p>
              <p className="text-xs text-neutral-600 max-w-sm">
                {getImageName(name)}
              </p>
            </div>
            <div className="flex items-center">
              <p className="text-xs text-neutral-900 max-w-sm">
                File type: &nbsp;
              </p>
              <p className="text-xs text-neutral-600 max-w-sm">
                {getImageType(name)}
              </p>
            </div>
            {!item.multiple && (
              <div className="flex items-center">
                <p className="text-xs text-neutral-900 max-w-sm">
                  File size: &nbsp;
                </p>
                <p className="text-xs text-neutral-600 max-w-sm">
                  {fetchedImageSize}
                </p>
              </div>
            )}
          </div>
        </Stack>
      )
    }
    return (
      <div className={`${item.class} relative`}>
        <label
          htmlFor="contained-button-file"
          className="text-sm py-2 ml-1 font-medium text-left text-[#606161] inline-block"
        >
          {item.title}
          {item.required && <span className="text-[#FF0000]"> *</span>}
        </label>
        <div className="file-input-box">
          <div className="upload-btn">
            <input
              type="file"
              accept="image/*"
              multiple={true}
              key={item?.id}
              onChange={(e) => handleFileChange(e, item)}
            />
          </div>
        </div>
        <p className="note">
          Multiple file selection allowed, Maximum size of 2MB for each file{" "}
          <span className="text-[#FF0000]"> *</span>
        </p>
        {item.error && (
          <p
            class="MuiFormHelperText-root Mui-error MuiFormHelperText-sizeSmall MuiFormHelperText-contained Mui-required css-k4qjio-MuiFormHelperText-root"
            id=":r29:-helper-text"
          >
            {item.helperText}
          </p>
        )}
        <div className="preview-image">
          {fileLoading.length > 0 && (
            <>
              {fileLoading.map((item, index) => (
                <div className="image skeleton-box" key={index}></div>
              ))}
            </>
          )}
          {selectedFiles?.length > 0 &&
            fileLoading.length === 0 &&
            selectedFiles?.map((image, index) => {
              return (
                <div className="image" key={index}>
                  <span
                    className="delete-icon"
                    onClick={(e) => removePreviewImage(e, image, item)}
                  >
                    <img src={CloseIcon} alt="close-icon" />
                  </span>
                  <img src={image.url} alt={image.name} className="img-show" />
                </div>
              )
            })}
        </div>
        {item.hasMicIcon && (
          <>
            <span className="mic-icon upload-image" onClick={openModal}>
              <img src={googleMicIcon} alt="" />
            </span>
            <Modal
              open={open}
              keepMounted
              //   onClose={() => setOpen(false)}
              aria-labelledby="modal-modal-title"
              aria-describedby="modal-modal-description"
            >
              <div className="speech-modal">
                <div className="modal-header">
                  <span
                    className="close-btn cursor-pointer"
                    onClick={closeModal}
                  >
                    <img src={CloseIcon} alt="close-icon" />
                  </span>
                </div>
                <div className="modal-body">
                  <TextBodyModal
                    listening={listening}
                    aiInput={aiInput}
                    item={item}
                    aiInputResponse={aiInputResponse}
                    setAiInput={setAiInput}
                    aiLoading={aiLoading}
                  />
                </div>
                <div className="modal-footer">
                  <div className="btn-group">
                    <div className="lang-select">
                      <Autocomplete
                        size="small"
                        options={languageList}
                        getOptionLabel={(option) => option.key}
                        value={selectLanguage}
                        isOptionEqualToValue={(option, value) =>
                          option.key === value.key
                        }
                        disableClearable={true}
                        onChange={(event, newValue) => {
                          setSelectLanguage(newValue)
                        }}
                        className="text-input"
                        renderInput={(params) => (
                          <TextField
                            {...params}
                            placeholder={"Select your language"}
                            variant="outlined"
                            error={item.error || false}
                            helperText={item.error && item.helperText}
                          />
                        )}
                      />
                    </div>
                    {!listening ? (
                      <button
                        className={`mic-button${
                          aiLoading ? " opacity-50 cursor-not-allowed" : ""
                        }`}
                        onClick={() => handleStartListening(item)}
                      >
                        <img src={WhiteMicIcon} alt="mic-icon" />
                      </button>
                    ) : (
                      <span className="mic-button">
                        <img src={voiceIcon} alt="voice-icon" />
                      </span>
                    )}
                    <button
                      className={`sbt-button${
                        aiInputResponse.length === 0
                          ? " opacity-50 cursor-not-allowed"
                          : ""
                      }`}
                      onClick={() => getInputTitle(item)}
                    >
                      {!aiLoading ? "Submit" : "Loading..."}
                    </button>
                  </div>
                </div>
              </div>
            </Modal>
          </>
        )}
        <Modal
          open={open}
          keepMounted
          //   onClose={() => setOpen(false)}
          aria-labelledby="modal-modal-title"
          aria-describedby="modal-modal-description"
        >
          <div className="speech-modal">
            <div className="modal-header">
              <span className="close-btn cursor-pointer" onClick={closeModal}>
                <img src={CloseIcon} alt="close-icon" />
              </span>
            </div>
            <div className="modal-body">
              <TextBodyModal
                listening={listening}
                aiInput={aiInput}
                item={item}
                aiInputResponse={aiInputResponse}
                setAiInput={setAiInput}
                aiLoading={aiLoading}
                removeImage={removeImage}
                editImage={editImage}
                isImageEdit={isImageEdit}
                setEditImageInputValue={setEditImageInputValue}
                editImageInputValue={editImageInputValue}
              />
            </div>
            <div className="modal-footer">
              <div className="btn-group">
                <div className="lang-select">
                  <Autocomplete
                    size="small"
                    options={languageList}
                    getOptionLabel={(option) => option.key}
                    value={selectLanguage}
                    isOptionEqualToValue={(option, value) =>
                      option.key === value.key
                    }
                    disableClearable={true}
                    onChange={(event, newValue) => {
                      setSelectLanguage(newValue)
                    }}
                    className="text-input"
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        placeholder={"Select your language"}
                        variant="outlined"
                        error={item.error || false}
                        helperText={item.error && item.helperText}
                      />
                    )}
                  />
                </div>
                {!listening ? (
                  <button
                    className={`mic-button${
                      aiLoading ? " opacity-50 cursor-not-allowed" : ""
                    }`}
                    onClick={() => handleStartListening(item)}
                  >
                    <img src={WhiteMicIcon} alt="mic-icon" />
                  </button>
                ) : (
                  <span className="mic-button">
                    <img src={voiceIcon} alt="voice-icon" />
                  </span>
                )}
                <button
                  className={`sbt-button${
                    aiInputResponse.length === 0 || aiLoading
                      ? " opacity-50 cursor-not-allowed"
                      : ""
                  }`}
                  onClick={() => fileUpload(aiInputResponse, item)}
                >
                  {!aiLoading ? "Upload" : "Loading..."}
                </button>
              </div>
            </div>
          </div>
        </Modal>
        {/* <FormControl error={item.error}>
          <input
            ref={uploadFileRef}
            id="contained-button-file"
            name="contained-button-file"
            style={{
              opacity: "none",
              color: item.fontColor ? item.fontColor : "#f0f0f0",
              marginBottom: 10
            }}
            accept="image/*"
            type="file"
            multiple={item?.multiple || false}
            key={item?.id}
            onChange={(e) => {
              const token = Cookies.get("token")
              for (const file of e.target.files) {
                if (!file.type.startsWith("image/")) {
                  cogoToast.warn("Only image files are allowed")
                  // reset file input
                  uploadFileRef.current.value = null
                  return
                }
                if (file.size > allowedMaxSize) {
                  cogoToast.warn("File size should be less than 2 MB")
                  // reset file input
                  uploadFileRef.current.value = null
                  return
                }
                const formData = new FormData()
                formData.append("file", file)
                getSignUrl(file).then((d) => {
                  const url = d.urls
                  console.log("url=====>", url)
                  axios(url, {
                    method: "PUT",
                    data: file,
                    headers: {
                      ...(token && { "access-token": `Bearer ${token}` }),
                      "Content-Type": "multipart/form-data"
                    }
                  })
                    .then((response) => {
                      setIsImageChanged(true)
                      if (item.multiple) {
                        stateHandler((prevState) => {
                          const newState = {
                            ...prevState,
                            [item.id]: [...prevState[item.id], d.path],
                            uploaded_urls: []
                          }
                          return newState
                        })
                      } else {
                        let reader = new FileReader()
                        let tempUrl = ""
                        reader.onload = function (e) {
                          tempUrl = e.target.result
                          stateHandler({
                            ...state,
                            [item.id]: d.path,
                            tempURL: {
                              ...state.tempURL,
                              [item.id]: tempUrl
                            }
                          })
                        }
                        reader.readAsDataURL(file)
                      }
                      response.json()
                    })
                    .then((json) => {})
                })
              }
            }}
          />

          {item.multiple ? (
            state[item.id]?.map((name) => {
              return <UploadedFile name={name} />
            })
          ) : (
            <UploadedFile name={state[item.id]} />
          )}
          {item.error && <FormHelperText>{item.helperText}</FormHelperText>}
        </FormControl> */}
      </div>
    )
  } else if (item.type === "label") {
    return <p className="text-2xl font-semibold mb-4 mt-14">{item.title}</p>
  }
}

export default ProductInput
