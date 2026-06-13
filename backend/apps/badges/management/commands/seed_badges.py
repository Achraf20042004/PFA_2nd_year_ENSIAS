"""
Management command: seed default achievement badges.
Run once after initial setup:  python manage.py seed_badges
"""
from django.core.management.base import BaseCommand

from apps.badges.models import Badge

BADGES = [
    {
        "nom": "Premiers Pas",
        "description": "Complète ton premier exercice de diagnostic.",
        "icone_svg": "🩺",
        "condition_type": Badge.ConditionType.PREMIER_EXO,
        "condition_seuil": 1,
    },
    {
        "nom": "Assidu",
        "description": "Pratique 3 jours consécutifs.",
        "icone_svg": "🔥",
        "condition_type": Badge.ConditionType.STREAK,
        "condition_seuil": 3,
    },
    {
        "nom": "Série de Feu",
        "description": "Pratique 7 jours consécutifs.",
        "icone_svg": "⚡",
        "condition_type": Badge.ConditionType.STREAK,
        "condition_seuil": 7,
    },
    {
        "nom": "Perfectionniste",
        "description": "Obtiens un score parfait sur un exercice.",
        "icone_svg": "🏅",
        "condition_type": Badge.ConditionType.SCORE_PARFAIT,
        "condition_seuil": 1,
    },
    {
        "nom": "Explorateur",
        "description": "Complète 10 exercices de diagnostic.",
        "icone_svg": "🔭",
        "condition_type": Badge.ConditionType.NB_TENTATIVES,
        "condition_seuil": 10,
    },
    {
        "nom": "Vétéran",
        "description": "Complète 50 exercices de diagnostic.",
        "icone_svg": "🎖️",
        "condition_type": Badge.ConditionType.NB_TENTATIVES,
        "condition_seuil": 50,
    },
    {
        "nom": "Polyvalent",
        "description": "Explore 2 domaines médicaux différents.",
        "icone_svg": "🧬",
        "condition_type": Badge.ConditionType.NB_MALADIES,
        "condition_seuil": 2,
    },
    {
        "nom": "Généraliste",
        "description": "Maîtrise les 3 domaines médicaux.",
        "icone_svg": "🌟",
        "condition_type": Badge.ConditionType.NB_MALADIES,
        "condition_seuil": 3,
    },
]


class Command(BaseCommand):
    help = "Seed default achievement badges into the database (idempotent)."

    def handle(self, *args, **options):
        created = 0
        for data in BADGES:
            _, is_new = Badge.objects.get_or_create(
                nom=data["nom"],
                defaults=data,
            )
            if is_new:
                created += 1
                self.stdout.write(self.style.SUCCESS(f"  Created: {data['nom']}"))
            else:
                self.stdout.write(f"  Already exists: {data['nom']}")

        self.stdout.write(self.style.SUCCESS(f"\nDone — {created} badge(s) created."))
