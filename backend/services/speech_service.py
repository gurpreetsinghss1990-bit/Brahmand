from google.cloud import speech_v2
from typing import Optional
import os

PROJECT_ID = os.environ.get("GCP_PROJECT_ID", "brahmand-260327-19251")

class SpeechService:
    def __init__(self):
        self.client = speech_v2.SpeechClient()
        self recognizer_name = f"projects/{PROJECT_ID}/locations/global/recognizers/_"

    async def transcribe_audio(self, audio_content: bytes, language_code: str = "en-IN") -> Optional[str]:
        """
        Transcribe audio content using Google Cloud Speech-to-Text v2
        
        Args:
            audio_content: Raw audio bytes
            language_code: Language code for transcription (default: en-IN)
        
        Returns:
            Transcribed text or None if failed
        """
        try:
            config = speech_v2.RecognitionConfig(
                auto_decoding_config=speech_v2.AutoDetectDecodingConfig(),
                language_codes=[language_code],
                model="chirp_3",
                enable_automatic_punctuation=True,
            )

            request = speech_v2.RecognizeRequest(
                recognizer=self.recognizer_name,
                config=config,
                content=audio_content,
            )

            response = self.client.recognize(request=request)

            transcripts = []
            for result in response.results:
                if result.alternatives:
                    transcripts.append(result.alternatives[0].transcript)

            if transcripts:
                return " ".join(transcripts)
            return None

        except Exception as e:
            print(f"Speech recognition error: {e}")
            return None

    async def transcribe_from_uri(self, audio_uri: str, language_code: str = "en-IN") -> Optional[str]:
        """
        Transcribe audio from a GCS URI
        
        Args:
            audio_uri: Google Cloud Storage URI (gs://bucket/object)
            language_code: Language code for transcription
        """
        try:
            config = speech_v2.RecognitionConfig(
                auto_decoding_config=speech_v2.AutoDetectDecodingConfig(),
                language_codes=[language_code],
                model="chirp_3",
                enable_automatic_punctuation=True,
            )

            request = speech_v2.RecognizeRequest(
                recognizer=self.recognizer_name,
                config=config,
                uri=audio_uri,
            )

            response = self.client.recognize(request=request)

            transcripts = []
            for result in response.results:
                if result.alternatives:
                    transcripts.append(result.alternatives[0].transcript)

            if transcripts:
                return " ".join(transcripts)
            return None

        except Exception as e:
            print(f"Speech recognition error: {e}")
            return None


speech_service = SpeechService()