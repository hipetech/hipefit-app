import { getAuth } from '@react-native-firebase/auth';
import { getFirestore } from '@react-native-firebase/firestore';

export const getFirebaseAuth = () => getAuth();

export const getFirebaseFirestore = () => getFirestore();

export const getFirebaseProjectId = (): string =>
  getAuth().app.options.projectId;
