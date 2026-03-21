import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { getFirebaseStorage } from './config';

export const uploadFileToFirebase = async (uri: string, path: string): Promise<string> => {
  try {
    const storage = getFirebaseStorage();
    const response = await fetch(uri);
    const blob = await response.blob();
    const storageRef = ref(storage, path);
    await uploadBytes(storageRef, blob);
    const downloadURL = await getDownloadURL(storageRef);
    return downloadURL;
  } catch (error) {
    console.error('Error uploading file: ', error);
    throw error;
  }
};
