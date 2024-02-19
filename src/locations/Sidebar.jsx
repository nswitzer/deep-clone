import React, { useState } from "react";
import { Stack, Button, Caption } from "@contentful/f36-components";
import { useSDK } from "@contentful/react-apps-toolkit";

const Sidebar = () => {
  const sdk = useSDK();

  var references = {};
  var referenceCount = 0;
  var newReferenceCount = 0;
  var updatedReferenceCount = 0;

  const [isLoading, setLoading] = useState(false);
  const [isDisabled, setDisabled] = useState(false);

  //initiate the clone process, show/hide loading, disable/enable button
  let clone = async () => {
    setLoading(true);
    setDisabled(true);
    const clonedEntry = await cloneEntry(sdk.ids.entry);

    let caption = document.getElementById("caption");

    if (sdk.parameters.installation.automaticRedirect === true) {
      await setTimeout(function () {
        sdk.navigator.openEntry(clonedEntry.sys.id);
      }, sdk.parameters.installation.msToRedirect);

      caption.innerHTML =
        "<a > Redirecting to newly created clone in " +
        Math.round(sdk.parameters.installation.msToRedirect / 1000, 2) +
        " seconds. </a>.";
    } else {
       }

    setLoading(false);
    setDisabled(false);
  };

  let redirectUser = (entryId) => {
    sdk.navigator.openEntry(entryId);
  };

  //find references in the current entry, and update the references for the entire reference tree
  let cloneEntry = async (entryId) => {
    await findReferences(sdk.ids.entry);
    const newReferences = await createNewEntriesFromReferences();
debugger
    await updateReferenceTree(newReferences);

    return newReferences[entryId];
  };

  let createNewEntriesFromReferences = async (tag) => {
    const newEntries = {};

    for (let entryId in references) {
      const entry = references[entryId];

      if (
        entry.fields.title &&
        entry.fields.title[sdk.locales.default] &&
        sdk.parameters.installation.cloneTextBefore
      )
        entry.fields.title[sdk.locales.default] =
          sdk.parameters.installation.cloneText +
          " " +
          entry.fields.title[sdk.locales.default];
      else if (
        entry.fields.title &&
        entry.fields.title[sdk.locales.default] &&
        !sdk.parameters.installation.cloneTextBefore
      )
        entry.fields.title[sdk.locales.default] =
          entry.fields.title[sdk.locales.default] +
          " " +
          sdk.parameters.installation.cloneText;

      let newEntry = "";
      
      if(entry !== undefined) { 
        newEntry = await sdk.cma.entry.create(
        { contentTypeId: entry.sys.contentType.sys.id },
        { fields: entry.fields },
      );

      newReferenceCount++;
      newEntries[entryId] = newEntry;
      }
      
    }

    return newEntries;
  };

  let updateReferencesOnField = async (field, newReferences) => {
    
    if (field && Array.isArray(field)) {
      return await Promise.all(
        field.map(async (f) => {
          return await updateReferencesOnField(f, newReferences);
        }),
      );
    }

    if (
      field &&
      field.sys &&
      field.sys.type === "Link" &&
      field.sys.linkType === "Entry"
    ) {
      const newReference = newReferences[field.sys.id];
      if(newReference !== undefined) field.sys.id = newReference.sys.id;
    }

    if (
      field &&
      field.sys &&
      field.sys.type === "Link" &&
      field.sys.linkType === "Asset"
    ) {

    }
  };

  let updateReferenceTree = async (newReferences) => {
    for (let entryId in newReferences) {
      const entry = newReferences[entryId];

      for (let fieldName in entry.fields) {
        const field = entry.fields[fieldName];

        for (let lang in field) {
          const langField = field[lang];

          //remove once assets are handled
          //if((langField.sys !== undefined && langField.sys.linkType !== 'Asset') || (langField.isArray() && langField[0].sys.linkType !== 'Asset')) {
          await updateReferencesOnField(langField, newReferences);
          //}
        }
      }

      await sdk.cma.entry.update({entryId: entry.sys.id}, {sys: entry.sys, fields: entry.fields})

      updatedReferenceCount++;
    }
  };

  let inspectField = async (field) => {
    if (field && Array.isArray(field)) {
      return await Promise.all(
        field.map(async (f) => {
          return await inspectField(f);
        }),
      );
    }

    if (
      field &&
      field.sys &&
      field.sys.type === "Link" &&
      field.sys.linkType === "Entry"
    ) {
      await findReferences(field.sys.id, "entry");
    }
    //// not needed, as we don't go further on assets
    if (sdk.parameters.installation.cloneAssets === true) {
      if (
        field &&
        field.sys &&
        field.sys.type === "Link" &&
        field.sys.linkType === "Asset"
      ) {
        //not part of POC
      }
    }
  };

  let findReferences = async (entryId, type = "entry") => {
    //entry already in the references, nothing to do
    if (references[entryId]) {
      return;
    }
    //check if it is an asset or not
    let entry = undefined;
    
    if (sdk.parameters.installation.cloneAssets === true && type === 'asset') {
      entry = await sdk.cma.asset.get({assetId: entryId}) 
    } else {
      
      try {
        entry = await sdk.cma.entry.get({ entryId: entryId });
      }
      catch (error) {
        console.log(error)
        //deleted or inaccessible item, let's remove it
        delete references[entryId]
              }
      
    }
    
    referenceCount++;
    if(entry !== undefined) {
      references[entryId] = entry;

      for (let fieldName in entry.fields) {
        const field = entry.fields[fieldName];
  
        for (let lang in field) {
          const langField = field[lang];
  
          await inspectField(langField);
        }
      }
    }
  
  };

  return (
    <Stack alignItems="start" flexDirection="column" spacing="spacingS">
      <Button
        variant="primary"
        isLoading={isLoading}
        isDisabled={isDisabled}
        onClick={clone}
      >
        Clone
      </Button>
      <Caption id="caption">
        This clones the entry and all referenced entries
      </Caption>
    </Stack>
  );
};

export default Sidebar;
