# Outline React Native Demo Video

The purpose of this 30 minute video is to explain how we can integrate the new Optimization SDK into a basic Contentful React Native app and use the core features of the SDK. 

* Introduction to the Optimization SDK  
  * How this is meant to replace the experience.js SDK  
  * Introduce [https://github.com/contentful/optimization](https://github.com/contentful/optimization)   
  * Briefly explain what the purpose of the RN SDK is, how tracking works, and quickly review personalization, in case there are people who are unfamiliar with the product  
* Review demo app  
  * This app already loads data from a Contentful organization using the SDK  
  * Demo app loads hardcoded IDs for banner, and then loads list of `Page` content that’s tappable and loads page content  
  * Show the app in action with basic unpersonalized content  
* Installing optimization SDK into the functional demo app  
  * Show steps via screenshots, how it’s easy to setup and get configured   
  * Necessary steps to setup baseline personalization   
  * Explain reference implementation, what the purpose of it is, and where to find it in the repository  
* Integrating personalization into the app \- most basic case with personalization and analytics component  
  * Show how we can wrap the App.tsx in an `OptimizationRoot` component to enable personalization throughout the app  
  * Briefly explain how this is different from `OptimizationProvider`  
  * Wrap banner entry in `<Personalization/>` component and update hardcoded banner entry to pull from personalized entry  
  * Explain `<Analytics/>` component and use that to wrap a CTFL component  
* Show preview panel  
  * Configure `OptimizationRoot` to show FAB via hardcoded boolean   
  * Toggle audiences in preview panel, show how live updates happen, and how it can be used to view details about the identified user  
* Explain available components deeper  
  * `<Personalization/>` and `<Analytics/>`, how they are different, quick   
  * Using `<ScrollProvider/>` to wrap components and how the tracking is fired by default  
  * `<OptimizationNavigationContainer>` and how using that will automatically track the page views  
  * Describe how offline support is handled with optional `@react-native-community/netinfo` library  
* Wrap up/contact info via Slack