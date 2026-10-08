import { HomeToday } from "@/components/home-today";
import { NAME_MEANING } from "@/lib/sources";
import styles from "./home.module.css";

export default function HomePage() {
  return (
    <section className={styles.hero}>
      <h1>اجعل القرآن دَيْدَنك</h1>
      <p>{NAME_MEANING}</p>
      <HomeToday />
    </section>
  );
}
