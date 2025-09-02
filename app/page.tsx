'use client';

import React from 'react';
import styles from '../styles/Home.module.css';

export default function Page() {
  return (
    <div className={styles.introContainer}>
      {/* Background decorative elements */}
      <div className={styles.backgroundElements}>
        <div className={styles.islamicPattern1}></div>
        <div className={styles.islamicPattern2}></div>
        <div className={styles.islamicPattern3}></div>
        <div className={styles.floatingGeometric}></div>
        <div className={styles.floatingGeometric2}></div>
      </div>

      {/* Main content */}
      <div className={styles.contentWrapper}>
        <div className={styles.welcomeSection}>
          <div className={styles.logoContainer}>
            <img src="/logo.png" alt="Almajd Academy Logo" className={styles.logo} />
          </div>
          <h1 className={styles.mainTitle}>
            <span className={styles.titleAccent}>Almajd</span> Academy
          </h1>
          <p className={styles.subtitle}>
            Access your video conference using the room link provided by your administrator
          </p>
        </div>

        <div className={styles.cardContainer}>
          <div className={styles.introCard}>
            <div className={styles.accessInstructions}>
              <div className={styles.instructionStep}>
                <div className={styles.stepNumber}>1</div>
                <div className={styles.stepContent}>
                  <h3>Receive Room Link</h3>
                  <p>Your administrator will provide you with a unique room link</p>
                </div>
              </div>
              
              <div className={styles.instructionStep}>
                <div className={styles.stepNumber}>2</div>
                <div className={styles.stepContent}>
                  <h3>Click the Link</h3>
                  <p>Open the room link in your browser to join the meeting</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
