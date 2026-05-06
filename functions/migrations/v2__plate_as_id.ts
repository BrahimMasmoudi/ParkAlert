import { MigrateOptions } from 'fireway';
export async function migrate({ firestore }: MigrateOptions) {
  const snapshot = await firestore.collection('cars').get();
  console.log(`Starting migration for ${snapshot.size} cars...`);

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const plateNumber = data.plateNumber;

    if (!plateNumber) {
      console.warn(`Car ${doc.id} has no plateNumber, skipping.`);
      continue;
    }

    const normalized = String(plateNumber).toUpperCase().replace(/[^A-Z0-9]/g, '');

    const newData = {
      ...data,
      plateNumberNormalized: normalized,
      id: normalized,
    };

    if (doc.id !== normalized) {
      console.log(`Moving car ${doc.id} -> ${normalized}`);

      const newDocRef = firestore.collection('cars').doc(normalized);
      const newDoc = await newDocRef.get();

      if (newDoc.exists) {
        console.warn(`Conflict: Document ${normalized} already exists. Merging data from ${doc.id}.`);
        await newDocRef.update(newData);
      } else {
        await newDocRef.set(newData);
      }
      await doc.ref.delete();
    } else {
      if (!data.plateNumberNormalized) {
        console.log(`Updating normalization field for car ${doc.id}`);
        await doc.ref.update({ plateNumberNormalized: normalized });
      }
    }
  }

  console.log('Migration v2 finished.');
}
