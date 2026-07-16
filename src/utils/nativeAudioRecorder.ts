import AudioRecorderPlayer, {
  AVEncodingOption,
} from 'react-native-audio-recorder-player';
import RNFS from 'react-native-fs';
import {PermissionsAndroid, Platform} from 'react-native';

const audioRecorderPlayer = new AudioRecorderPlayer();
let recordingPath: string | null = null;

async function ensureMicPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') {
    return true;
  }

  const alreadyGranted = await PermissionsAndroid.check(
    PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
  );

  if (alreadyGranted) {
    return true;
  }

  const result = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
    {
      title: 'Microphone Permission',
      message:
        'Myna needs microphone access so you can send voice messages in chat.',
      buttonPositive: 'Allow',
      buttonNegative: 'Deny',
    },
  );

  return result === PermissionsAndroid.RESULTS.GRANTED;
}

function getRecordingPath(): string {
  const fileName = `stt-recording-${Date.now()}.m4a`;

  if (Platform.OS === 'ios') {
    return `${RNFS.DocumentDirectoryPath}/${fileName}`;
  }

  return `${RNFS.CachesDirectoryPath}/${fileName}`;
}

export async function startNativeRecording(): Promise<void> {
  const hasPermission = await ensureMicPermission();

  if (!hasPermission) {
    throw new Error('Microphone permission denied');
  }

  if (recordingPath) {
    await cancelNativeRecording();
  }

  const path = getRecordingPath();

  if (Platform.OS === 'android') {
    recordingPath = await audioRecorderPlayer.startRecorder(path);
    return;
  }

  recordingPath = await audioRecorderPlayer.startRecorder(path, {
    AVFormatIDKeyIOS: AVEncodingOption.aac,
    AVNumberOfChannelsKeyIOS: 1,
    AVSampleRateKeyIOS: 44100,
  });
}

export async function stopNativeRecording(): Promise<{
  base64: string;
  mimeType: string;
  fileName: string;
}> {
  const resultPath = await audioRecorderPlayer.stopRecorder();
  audioRecorderPlayer.removeRecordBackListener();

  const path = resultPath || recordingPath;

  if (!path) {
    throw new Error('No recording file was created');
  }

  const base64 = await RNFS.readFile(path, 'base64');
  await RNFS.unlink(path).catch(() => undefined);
  recordingPath = null;

  return {
    base64,
    mimeType: 'audio/mp4',
    fileName: 'stt-recording.m4a',
  };
}

export async function cancelNativeRecording(): Promise<void> {
  try {
    await audioRecorderPlayer.stopRecorder();
  } catch {
    // ignore if recording was not active
  }

  audioRecorderPlayer.removeRecordBackListener();

  if (recordingPath) {
    await RNFS.unlink(recordingPath).catch(() => undefined);
    recordingPath = null;
  }
}
